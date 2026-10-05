import os
import shutil
import re

# Move files
os.rename('ile_project_settings.py', 'backend/database.py')
os.rename('ile_app/models.py', 'backend/models.py')
os.rename('ile_app/views.py', 'backend/routers/tools.py')
shutil.rmtree('ile_app')

# Update database.py
# (No changes needed usually, it just exports Base, engine, get_db)

# Update models.py
with open('backend/models.py', 'r') as f:
    content = f.read()
content = content.replace('from ile_project_settings import Base', 'from backend.database import Base')
with open('backend/models.py', 'w') as f:
    f.write(content)

# Update tools.py
with open('backend/routers/tools.py', 'r') as f:
    content = f.read()
content = content.replace('from ile_project_settings import', 'from backend.database import')
content = content.replace('from ile_app.models import', 'from backend.models import')
with open('backend/routers/tools.py', 'w') as f:
    f.write(content)

# Update auth.py
with open('backend/routers/auth.py', 'r') as f:
    content = f.read()
content = content.replace('from ile_project_settings import', 'from backend.database import')
content = content.replace('from ile_app.models import', 'from backend.models import')
with open('backend/routers/auth.py', 'w') as f:
    f.write(content)

# Update dev.py (if exists and uses them)
if os.path.exists('backend/routers/dev.py'):
    with open('backend/routers/dev.py', 'r') as f:
        content = f.read()
    content = content.replace('from ile_project_settings import', 'from backend.database import')
    content = content.replace('from ile_app.models import', 'from backend.models import')
    with open('backend/routers/dev.py', 'w') as f:
        f.write(content)

# Update main.py
with open('main.py', 'r') as f:
    content = f.read()
content = content.replace('from ile_project_settings import', 'from backend.database import')
content = content.replace('from ile_app.models import', 'from backend.models import')
content = content.replace('from ile_app import views', 'from backend.routers import tools')
content = content.replace('views.tools_router', 'tools.tools_router')
with open('main.py', 'w') as f:
    f.write(content)

print("Restructuring complete!")
