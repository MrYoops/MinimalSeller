
import os
import glob
import re

ROUTERS_DIR = "backend/routers"

def fix_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        original_content = content
        
        # internal imports from backend root
        # from server import -> from backend.server import
        content = re.sub(r"from server import", "from backend.server import", content)
        content = re.sub(r"import server", "import backend.server", content)
        
        # from ozon_all_parsers import -> from backend.ozon_all_parsers import
        content = re.sub(r"from ozon_all_parsers import", "from backend.ozon_all_parsers import", content)
        content = re.sub(r"import ozon_all_parsers", "import backend.ozon_all_parsers", content)
        
        if content != original_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Fixed imports in: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error {filepath}: {e}")
        return False

def main():
    print("🚀 Fixing router imports...")
    files = glob.glob(os.path.join(ROUTERS_DIR, "*.py"))
    
    count = 0
    for filepath in files:
        if fix_file(filepath):
            count += 1
            
    print(f"✨ Finished. Fixed {count} files.")

if __name__ == "__main__":
    main()
