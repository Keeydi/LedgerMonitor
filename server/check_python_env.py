#!/usr/bin/env python3
"""
Diagnostic script to check Python environment and package installation.
Run this to verify your Python setup matches what Node.js will use.
"""

import sys
import subprocess
import os

def check_python_info():
    """Display Python environment information."""
    print("=" * 60)
    print("Python Environment Diagnostic")
    print("=" * 60)
    print(f"Python Version: {sys.version}")
    print(f"Python Executable: {sys.executable}")
    print(f"Python Path: {sys.path[0]}")
    print(f"Platform: {sys.platform}")
    print()

def check_packages():
    """Check if required packages are installed."""
    print("=" * 60)
    print("Package Installation Check")
    print("=" * 60)
    
    required_packages = {
        'google-generativeai': 'google.generativeai',
        'Pillow': 'PIL'
    }
    
    all_installed = True
    for package_name, import_name in required_packages.items():
        try:
            __import__(import_name)
            print(f"✅ {package_name}: INSTALLED")
            
            # Try to get version
            try:
                if import_name == 'google.generativeai':
                    import google.generativeai as genai
                    print(f"   Version: {getattr(genai, '__version__', 'unknown')}")
                elif import_name == 'PIL':
                    from PIL import Image
                    print(f"   Version: {Image.__version__}")
            except:
                pass
        except ImportError as e:
            print(f"❌ {package_name}: NOT INSTALLED")
            print(f"   Error: {e}")
            all_installed = False
    
    print()
    return all_installed

def show_installation_command():
    """Show the exact command to install packages."""
    print("=" * 60)
    print("Installation Instructions")
    print("=" * 60)
    print(f"To install the required packages, run:")
    print(f"  {sys.executable} -m pip install google-generativeai pillow")
    print()
    print("Or if you're using a virtual environment:")
    print("  1. Activate your virtual environment first")
    print("  2. Then run: pip install google-generativeai pillow")
    print()

def main():
    check_python_info()
    packages_ok = check_packages()
    show_installation_command()
    
    if packages_ok:
        print("=" * 60)
        print("✅ All packages are installed correctly!")
        print("=" * 60)
        return 0
    else:
        print("=" * 60)
        print("❌ Some packages are missing. Install them using the command above.")
        print("=" * 60)
        return 1

if __name__ == '__main__':
    sys.exit(main())
