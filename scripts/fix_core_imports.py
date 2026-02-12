
import os
import glob

BACKEND_DIR = "backend"

def fix_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        new_content = content.replace("from core.", "from backend.core.")
        new_content = new_content.replace("import core.", "import backend.core.")
        
        # Avoid double backend.backend
        new_content = new_content.replace("backend.backend.core", "backend.core")
        
        if content != new_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"✅ Fixed imports in: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error {filepath}: {e}")
        return False

def main():
    print("🚀 Fixing core imports...")
    files = glob.glob(os.path.join(BACKEND_DIR, "**/*.py"), recursive=True)
    
    count = 0
    for filepath in files:
        if "backend\\core\\" in filepath or "backend/core/" in filepath:
            continue
        if "scripts" in filepath:
            continue
            
        if fix_file(filepath):
            count += 1
            
    print(f"✨ Finished. Fixed {count} files.")

if __name__ == "__main__":
    main()
