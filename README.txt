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

	arrows: move selected cell
	SHIFT + arrows: move selected cell by 3
	click on cell: make selected
	COMMAND click a cell: select multiple cells
	space: toggle selected cell(s)

	*There are 2 grids. The left side is for devices, the right for signals. Select link(s) on the left and Press "ADD" to include the linked devices in the signals grid.
	**devices must be linked for connection to work (a future version will create the link automatically)
	***state of the view is not retained when switching view or view modes