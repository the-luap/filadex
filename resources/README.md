# Filadex Resource Files

This directory contains CSV files that can be used to initialize and populate the Filadex application with common filament materials, colors, and vendors. These files serve as a starting point for your filament management system.

## Available CSV Files

### 1. `materials_init.csv`

This file contains a list of different printable filament materials that can be used in 3D printing. Each line represents a unique material type.

**Format:**
```
Material
PLA Basic
PLA Matte
PLA Silk+
...
```

### 2. `filament_colors_init.csv`

This file contains a comprehensive list of filament colors organized by brand/manufacturer. It includes both the color name and its corresponding hex code for visual representation in the application.

**Format:**
```
Brand,Color Name,Hex Code
Bambu Lab,Jade White,#FFFFFF
Bambu Lab,Beige,#F7E6DE
...
```

### 3. `vendors_init.csv`

This file contains a list of filament manufacturers/vendors that produce 3D printing filaments.

**Format:**
```
Manufacturer
Bambu Lab
Prusament
eSun
...
```

## Usage

These CSV files can be imported directly into the Filadex application through the settings interface. The application provides an import/export functionality that allows you to:

1. Import these pre-populated lists to quickly set up your filament database
2. Export your current data to share with others or back up your configuration

## Contributing

The community is welcome to enhance these resource files by adding more materials, colors, and vendors. When contributing:

1. Please ensure you don't create duplicate entries
2. Maintain the same format as the existing entries
3. For color entries, include accurate hex codes when possible
4. For material entries, use consistent naming conventions

These files were initially created based on web research and community contributions. By maintaining and expanding this database together, we can build a comprehensive resource for the 3D printing community.
