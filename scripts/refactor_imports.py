
import os
import glob

# Mappings of old modules to new core modules
MAPPING = {
    "from config import": "from core.config import",
    "import config": "import core.config as config", # Rare case but possible
    "from logging_config import": "from core.logging import",
    "from database import": "from core.database import",
    "from encrypt_utils import": "from core.security import"
}

BACKEND_DIR = "backend"

def refactor_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        original_content = content
        
        for old_import, new_import in MAPPING.items():
            # Basic replace - this covers most cases "from module import ..."
            # We need to be careful not to replace "from config_something" but here we match "from config "
            
            # Simple string replacement might be dangerous if not handled carefully.
            # However, given the project structure, these names are specific.
            # We will use exact match on "from X import"
            
            if old_import in content:
                content = content.replace(old_import, new_import)
                
        if content != original_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Updated imports in: {filepath}")
            return True
            
    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def main():
    print("🚀 Starting import refactoring...")
    
    # Get all .py files in backend/ and subdirectories
    # We want to avoid replacing inside backend/core/ itself if they refer to each other?
    # backend/core files shouldn't import from "database" but from "." or similar if they are internal,
    # but the old files were in root backend/.
    # Files in backend/core/ were just created, they shouldn't have "from database import".
    # Wait, copying content might have preserved imports?
    # I wrote the files manually with correct imports (e.g. database.py has "from .config import settings").
    # So we should be safe.
    
    files = glob.glob(os.path.join(BACKEND_DIR, "**/*.py"), recursive=True)
    
    count = 0
    for filepath in files:
        # Skip the core directory itself to avoid circular messes or mess ups
        if "backend\\core\\" in filepath or "backend/core/" in filepath:
            continue
            
        if refactor_file(filepath):
            count += 1
            
    print(f"✨ Finished. Updated {count} files.")

if __name__ == "__main__":
    main()
