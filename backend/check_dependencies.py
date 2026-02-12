#!/usr/bin/env python
"""Проверка и установка недостающих зависимостей"""
import sys

missing = []

try:
    import apscheduler
    print("✓ APScheduler установлен")
except ImportError:
    print("✗ APScheduler НЕ установлен")
    missing.append("APScheduler==3.11.1")

if missing:
    print(f"\nУстановка недостающих модулей: {', '.join(missing)}")
    import subprocess
    for package in missing:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    print("\n✓ Все зависимости установлены!")
else:
    print("\n✓ Все зависимости на месте!")
