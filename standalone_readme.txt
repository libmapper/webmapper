WebMapper 0.2
GUI for libmapper OSC network
Stephen Sinclair, Aaron Krajeski & Jon Wilansky
Email: (aaron dot krajeski at mail dot mcgill dot ca)
http://libmapper.org

Dependancies:

	- Google Chrome, you can theoretically run it in any browser, though I really wouldn't recommend it.

To Run:

	- Double click on 'WebMapper.app'
	- If Google Chrome is installed on your computer, and is not currently open, a window with the GUI should open automatically.
	- If Google Chrome is already running, navigate to "localhost:50000" to open the GUI.

List View Command Keys:

	- 'c' : connect/link selected signals/devices
	- 'delete' : delete selected connections/links
	- 'm' : mute selected connections
	- 'alt+tab' : move right one tab
	- 'alt+shift+tab' : move left one tab
	- 'cmd+a' : select all currently visible connections/links	

Grid view Command keys:

	arrows: move selected cell
	SHIFT + arrows: move selected cell by 3
	click on cell: make selected
	COMMAND click a cell: select multiple cells
	space: toggle selected cell(s)

	*There are 2 grids. The left side is for devices, the right for signals. Select link(s) on the left and Press "ADD" to include the linked devices in the signals grid.
	**devices must be linked for connection to work (a future version will create the link automatically)
	***state of the view is not retained when switching view or view modes


Known bugs:
	- Saving does not work in the grid mode


	Have fun! Do report any bugs.
