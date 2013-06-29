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


	click on cell: select the cellmateselected
	COMMAND click a cell: select multiple cells

	arrows: move selected cell
	SHIFT + arrows: move selected cell by 3

	space: toggle selected cell(s)
	c: connect selected cell(s)
	d: disconnect selected cell(s)

	CTRL +: zoom in on active grid
	CTRL -: zoom out on active grid
	CTRL 0: zoom-to-fit on active grid
	CTRL 1: switch to split view
	CTRL 2: switch to devices only view
	CTRL 3: switch to signals only view

	Instructions: There are 2 grids. The left side is the devices grid, the right is the signals grid. Select cells or device labels on the left and press the "Add"/"Remove" button to include/exclude the selected devices in the signals grid. You can also use the keyboard arrows to move the selected cell around. All keyboard shortcuts affect the 'active' grid, indicated by the little square in the upper left corner of the grid.
 *tested on Google Chrome only