#!/usr/bin/env python3

"""
RunSmart Info.plist Fixer
This script finds and updates your iOS Info.plist with required
location permissions for GPS tracking
"""

import os
import sys
import shutil
from pathlib import Path

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'

def find_infoplist():
    """Find Info.plist in the iOS project"""
    print(f"{BLUE}🔍 Searching for Info.plist in iOS project...{RESET}\n")
    
    # Common locations for Capacitor iOS projects
    possible_locations = [
        "ios/App/App/Info.plist",
        "apps/ios/App/App/Info.plist",
        "App/App/Info.plist",
        "ios/App/Info.plist",
        "apps/ios/App/Info.plist",
    ]
    
    # Check common locations first
    for location in possible_locations:
        if os.path.isfile(location):
            print(f"{GREEN}✅ Found Info.plist at: {location}{RESET}")
            return location
    
    # Search entire project
    print(f"{YELLOW}⚠️  Not found in common locations. Searching entire project...{RESET}")
    for root, dirs, files in os.walk("."):
        # Skip node_modules and Pods
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'Pods', '.git']]
        
        for file in files:
            if file == "Info.plist" and "ios" in root.lower():
                path = os.path.join(root, file)
                print(f"{GREEN}✅ Found Info.plist at: {path}{RESET}")
                return path
    
    print(f"{RED}❌ Error: Could not find Info.plist in iOS project{RESET}\n")
    print("Please locate your Info.plist manually in Xcode:")
    print("1. Open Xcode")
    print("2. Look in left navigator: App > App > Info.plist")
    print("3. Or select App target > Info tab")
    return None

def check_existing_permissions(plist_path):
    """Check if location permissions already exist"""
    print(f"\n{BLUE}📋 Checking for required location permissions...{RESET}\n")
    
    with open(plist_path, 'r') as f:
        content = f.read()
    
    has_when_in_use = "NSLocationWhenInUseUsageDescription" in content
    has_always = "NSLocationAlwaysAndWhenInUseUsageDescription" in content
    has_motion = "NSMotionUsageDescription" in content
    
    if has_when_in_use:
        print(f"{GREEN}✅ NSLocationWhenInUseUsageDescription already exists{RESET}")
    else:
        print(f"{YELLOW}⚠️  NSLocationWhenInUseUsageDescription is MISSING{RESET}")
    
    if has_always:
        print(f"{GREEN}✅ NSLocationAlwaysAndWhenInUseUsageDescription already exists{RESET}")
    else:
        print(f"{YELLOW}⚠️  NSLocationAlwaysAndWhenInUseUsageDescription is MISSING{RESET}")
    
    if has_motion:
        print(f"{GREEN}✅ NSMotionUsageDescription already exists{RESET}")
    else:
        print(f"{YELLOW}⚠️  NSMotionUsageDescription is MISSING{RESET}")
    
    return has_when_in_use and has_always and has_motion

def add_permissions(plist_path):
    """Add location permissions to Info.plist"""
    
    # Create backup
    print(f"\n{BLUE}📝 Creating backup of Info.plist...{RESET}")
    backup_path = f"{plist_path}.backup"
    shutil.copy2(plist_path, backup_path)
    print(f"{GREEN}✅ Backup created at: {backup_path}{RESET}")
    
    print(f"\n{BLUE}🔧 Adding/updating location permissions...{RESET}\n")
    
    with open(plist_path, 'r') as f:
        content = f.read()
    
    # Find the last </dict> tag (before the closing </plist>)
    insert_position = content.rfind('</dict>')
    
    if insert_position == -1:
        print(f"{RED}❌ Error: Invalid Info.plist format (no </dict> found){RESET}")
        return False
    
    # Prepare permissions to add
    permissions = []
    
    if "NSLocationWhenInUseUsageDescription" not in content:
        permissions.append('''	<key>NSLocationWhenInUseUsageDescription</key>
	<string>RunSmart needs access to your location to accurately track your running distance, pace, and route while you use the app.</string>
''')
        print(f"{GREEN}✅ Adding NSLocationWhenInUseUsageDescription{RESET}")
    
    if "NSLocationAlwaysAndWhenInUseUsageDescription" not in content:
        permissions.append('''	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>RunSmart needs continuous location access to track your runs even when the app is in the background, ensuring accurate route and distance tracking throughout your entire workout.</string>
''')
        print(f"{GREEN}✅ Adding NSLocationAlwaysAndWhenInUseUsageDescription{RESET}")
    
    if "NSMotionUsageDescription" not in content:
        permissions.append('''	<key>NSMotionUsageDescription</key>
	<string>RunSmart uses motion sensors to track your steps, cadence, and running form for more accurate fitness insights.</string>
''')
        print(f"{GREEN}✅ Adding NSMotionUsageDescription{RESET}")
    
    if not permissions:
        print(f"{GREEN}✅ All permissions already exist!{RESET}")
        return True
    
    # Insert permissions before the last </dict>
    new_content = (
        content[:insert_position] +
        '\n'.join(permissions) +
        content[insert_position:]
    )
    
    # Write updated content
    with open(plist_path, 'w') as f:
        f.write(new_content)
    
    return True

def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}RunSmart Info.plist Fixer{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Find Info.plist
    plist_path = find_infoplist()
    if not plist_path:
        sys.exit(1)
    
    # Check existing permissions
    all_exist = check_existing_permissions(plist_path)
    
    if all_exist:
        print(f"\n{GREEN}🎉 All required permissions already exist!{RESET}")
        print(f"\n{BLUE}If GPS still isn't working:{RESET}")
        print("1. Delete app from iPhone")
        print("2. Clean build in Xcode: Product > Clean Build Folder (⌘⇧K)")
        print("3. Build and run again: Product > Run (⌘R)")
        print("4. Permission dialog should appear when starting a run")
        return
    
    # Ask user to proceed
    print(f"\n{YELLOW}❓ Would you like to add the missing permissions? (y/n): {RESET}", end='')
    response = input().strip().lower()
    
    if response != 'y':
        print(f"{RED}❌ Cancelled. No changes made.{RESET}")
        sys.exit(0)
    
    # Add permissions
    if add_permissions(plist_path):
        print(f"\n{GREEN}{'='*60}{RESET}")
        print(f"{GREEN}🎉 Success! Info.plist has been updated.{RESET}")
        print(f"{GREEN}{'='*60}{RESET}\n")
        
        print(f"{BLUE}📋 Next steps:{RESET}")
        print("1. In Xcode, close the project if open (⌘Q)")
        print("2. Reopen Xcode: npx cap open ios")
        print("3. Delete the app from your iPhone 13")
        print("4. Clean build folder: Product > Clean Build Folder (⌘⇧K)")
        print("5. Build and run: Product > Run (⌘R)")
        print("6. Test GPS - permission dialog should appear")
        
        print(f"\n{BLUE}💾 A backup of your original Info.plist was saved at:{RESET}")
        print(f"   {plist_path}.backup")
        
        print(f"\n{BLUE}If you need to restore the backup:{RESET}")
        print(f"   cp {plist_path}.backup {plist_path}")
        print()
    else:
        print(f"\n{RED}❌ Failed to update Info.plist{RESET}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{RED}❌ Cancelled by user.{RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{RED}❌ Error: {e}{RESET}")
        sys.exit(1)
