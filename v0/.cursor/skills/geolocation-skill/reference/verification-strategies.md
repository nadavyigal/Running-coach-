# Web Search Verification Strategies

Patterns for using web search to verify geolocation hypotheses.

## Search Query Patterns

### Exact Text Verification
When sign text is visible:
```
"[exact text from sign]" location
"[exact text from sign]" address
"[business name]" [suspected city]
```

### Road/Route Identification
```
[road number] [country name] highway
route [number] [region]
"[road designation]" map
```

### Landmark Identification
```
[distinctive feature] landmark [suspected region]
[building description] [city/region]
famous [building type] [country]
```

### Infrastructure Verification
```
[utility company name] [country]
[specific sign text] traffic sign
[phone prefix] country code
```

## Verification Hierarchy

### High-Confidence Verifications
1. **Unique business names** → Direct location confirmation
2. **Street addresses visible** → Exact location
3. **Distinctive landmarks** → Strong geographic anchor
4. **License plate formats** → Country/region confirmation

### Medium-Confidence Verifications
1. **Language combinations** → Narrows to regions
2. **Infrastructure style** → Country-level hints
3. **Vegetation + architecture** → Climate zone + culture
4. **Brand presence patterns** → Regional indicators

### Low-Confidence (Supplementary)
1. **Sun angle** → Hemisphere only
2. **Generic signage** → Broad regional hints
3. **Vehicle types** → General region

## Search Result Interpretation

### Confirming Signals
- Multiple independent sources agree on location
- Street View or Maps reference matches visual
- Local news/business sites reference same features
- Government/official sources confirm details

### Warning Signals
- Only one source mentions location
- Tourist sites with potentially wrong labels
- User-generated content without verification
- Conflicting regional attributions

## Cross-Reference Strategies

### Triangulation Approach
1. Search for most specific clue first
2. Verify result against second independent clue
3. Confirm with third clue if available
4. Accept if 2+ independent confirmations align

### Disambiguation
When initial search returns multiple possible locations:
1. Add regional qualifier from other clues
2. Search for unique combination of features
3. Look for local sources that mention multiple observed features together

## Common Pitfalls

### False Positives
- Chain stores present in multiple countries
- Similar signage styles across regions
- Tourist areas with multilingual signs
- International airports (not representative of country)

### Verification Limits
- Some regions have limited online presence
- Historical images may not match current search results
- Seasonal changes affect vegetation matches
- Recent construction may not appear in searches

## Search Efficiency

### First-Pass Searches
Start with highest-specificity, lowest-ambiguity clues:
1. Exact text strings (business names, addresses)
2. Unique combinations (specific road + region)
3. Distinctive landmarks or features

### Refinement Searches
If first-pass inconclusive:
1. Broaden geographic scope
2. Search for clue patterns rather than exact matches
3. Look for "things unique to [region]" patterns
