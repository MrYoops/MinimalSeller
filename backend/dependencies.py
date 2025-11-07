# Shared dependencies for routes
# This module will be imported by server.py after db is initialized

db = None
get_current_user = None
require_role = None

def set_db(database):
    global db
    db = database

def set_dependencies(current_user_func, role_func):
    global get_current_user, require_role
    get_current_user = current_user_func
    require_role = role_func
