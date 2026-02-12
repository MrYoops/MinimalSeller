# Установка зависимостей

## Проблема: ModuleNotFoundError: No module named 'slowapi'

Если при запуске сервера возникает ошибка о недостающих модулях, выполните:

### Windows (PowerShell):
```powershell
cd backend
python -m pip install -r requirements.txt
```

### Или установите только slowapi:
```powershell
cd backend
python -m pip install slowapi==0.1.9
```

### Если python не найден:
1. Убедитесь, что Python установлен
2. Используйте полный путь к Python, например:
   ```powershell
   C:\Users\dkuzm\AppData\Local\Programs\Python\Python311\python.exe -m pip install -r requirements.txt
   ```

### Проверка установки:
```powershell
python -m pip list | findstr slowapi
```

Должно показать: `slowapi 0.1.9`

---

**После установки перезапустите сервер!**
