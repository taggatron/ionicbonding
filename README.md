# Ionic Bonding Interactive

An interactive, bright-styled simulation demonstrating ionic bonding by electron transfer and ion classification.

## Features

- Clickable valence electron transfer from a metal (Na) to a non-metal (Cl)
- Smooth animation for electron movement between atoms
- Charge badges update after transfer (`Na+`, `Cl−`)
- Drag-and-drop activity to classify ions into cation and anion
- Modern gradient theme with subtle motion and responsive layout
- Giant ionic lattice slice showing multi-directional bonding (hover to see neighbors)
- Cation selector: switch between Na (1e− transfer) and Mg (2e− transfer forming MgCl₂)

## Run locally

Use any static server. On macOS with Python:

```bash
# from the project root
cd "ionicbonding"
python3 -m http.server 5173
# open http://localhost:5173 in your browser
```

Or use VS Code Live Server.

## How it works

- Two SVG-based Bohr diagrams are rendered for Sodium and Chlorine.
- Clicking the Na valence electron removes it from Na and animates it to the next slot in Cl's outer shell.
- The UI updates to show `+1` for Na and `-1` for Cl, enabling Step 2.
- In Step 2, drag ions to zones. For sodium: `Na+` and `Cl−`. For magnesium: `Mg2+` and two `Cl−` ions.

## Reset

Use the Reset button in the header or the Start Over button in Step 2 to reset the simulation.
