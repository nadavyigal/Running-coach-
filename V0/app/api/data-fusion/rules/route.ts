import { NextRequest, NextResponse } from 'next/server';
import { DataFusionEngine } from '../../../../lib/dataFusionEngine';
import { db } from '../../../../lib/db';

const fusionEngine = new DataFusionEngine();

// GET /api/data-fusion/rules - Get fusion rules for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    
    const rules = await db.dataFusionRules
      .where('userId')
      .equals(userId)
      .toArray();
    
    // Get data sources for context
    const dataSources = await fusionEngine.getDataSources(userId);
    
    return NextResponse.json({
      success: true,
      data: {
        rules,
        dataSources,
        defaultRules: this.getDefaultRules(userId, dataSources)
      }
    });
    
  } catch (error) {
    console.error('Error getting fusion rules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve fusion rules'
      },
      { status: 500 }
    );
  }
}

// PUT /api/data-fusion/rules - Update data fusion rules and priorities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, rules } = body;
    
    if (!userId || !rules || !Array.isArray(rules)) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId and rules array are required'
        },
        { status: 400 }
      );
    }
    
    const updatedRules = [];
    
    for (const rule of rules) {
      const ruleData = {
        userId,
        dataType: rule.dataType,
        primarySource: rule.primarySource,
        fallbackSources: rule.fallbackSources || [],
        conflictResolution: rule.conflictResolution || 'prefer_primary',
        gapFillingEnabled: rule.gapFillingEnabled !== false,
        qualityThreshold: rule.qualityThreshold || 50,
        updatedAt: new Date()
      };
      
      // Check if rule exists
      const existingRule = await db.dataFusionRules
        .where({ userId, dataType: rule.dataType })
        .first();
      
      if (existingRule) {
        // Update existing rule
        await db.dataFusionRules.update(existingRule.id!, ruleData);
        updatedRules.push({ ...ruleData, id: existingRule.id });
      } else {
        // Create new rule
        const ruleId = await db.dataFusionRules.add({
          ...ruleData,
          createdAt: new Date()
        });
        updatedRules.push({ ...ruleData, id: ruleId });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        rules: updatedRules,
        message: `Updated ${updatedRules.length} fusion rules`
      }
    });
    
  } catch (error) {
    console.error('Error updating fusion rules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update fusion rules'
      },
      { status: 500 }
    );
  }
}

// Helper function to get default rules
function _getDefaultRules(userId: number, dataSources: any[]) {
  const dataTypes = ['heart_rate', 'steps', 'calories', 'distance', 'pace', 'sleep'];
  
  return dataTypes.map(dataType => {
    // Find the best source for this data type
    const capableSources = dataSources.filter(source => {
      const capabilities = JSON.parse(source.capabilities || '[]');
      return capabilities.includes(dataType);
    });
    
    // Sort by priority and accuracy
    const sortedSources = capableSources.sort((a, b) => {
      return (b.priority * b.accuracy) - (a.priority * a.accuracy);
    });
    
    return {
      userId,
      dataType,
      primarySource: sortedSources[0]?.deviceId || 'unknown',
      fallbackSources: sortedSources.slice(1).map(s => s.deviceId),
      conflictResolution: 'prefer_primary',
      gapFillingEnabled: true,
      qualityThreshold: 50
    };
  });
}