A web-based GUI for the mapper protocol.

To run:
	1. Copy _mapper.so and mapper.py from libmapper/swig into webmapper directory.
	2. Run webmapper.py from terminal
		- Terminal will display "serving at port #####" 
		(where ##### is a string of 5 numbers)
	3. Open a browser
	4. Type "localhost:#####" into the address bar 
	(where ##### is the same string of 5 numbers displayed in terminal).

List view Command keys:
	'c' : Connect selected devices/signals
	'delete': Delete selected links/connections
	'cmd+a'	: Select all links/connections
	'alt+tab' : Change tab to the right
	'alt+shift+tab' : Change tab to the left


Grid view Command keys:

	click on cell: set the cell as selected
	COMMAND click a cell: select multiple cells

	arrows: move selected cell
	SHIFT + arrows: move selected cell by 3

	space: toggle selected cell(s)
	c: connect selected cell(s)
	d: disconnect selected cell(s)

	CTRL +: zoom in on active grid
	CTRL -: zoom out on active grid
	CTRL 0: zoom-to-fit on active grid
	CTRL 1: switch to SPLIT view
	CTRL 2: switch to DEVICES only view
	CTRL 3: switch to SIGNALS only view

	ALT leftArrow: set DEVICES grid as active
	ALT rightArrow: set SIGNALS grid as active
	ALT up/down arrows: cycle through presets

Grid View Instructions: 

- There are 2 grids. The left side is the DEVICES grid, the right is the SIGNALS grid. 

- To view signals in the SIGNALS grid: select cells (or labels) on the DEVICES grid and press the "Add"/"Remove" button ('a'/'s' keyboard shortcut). This will include/exclude the selected devices in the SIGNALS grid. Vertical/horizontal lines indicate if the device is included. 

- You can use the keyboard arrows to move the selected cell around. All keyboard shortcuts affect the 'active' grid, indicated by the little square in the upper left corner of the grid.

- You can save the current view in the SIGNALS grid as a 'preset' using the "SaveNew" button on the top right hand side. Note that changes to the current preset will not be remembered unless you press the "Update" button.

- Note the keyboard shortcuts for changing the active grid, moving the selected cell, toggling cells, loading presets, É they enable you to use the interface much more efficiently.

 *Grid view was developed and tested on Google Chrome only.

