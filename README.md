A browser-based GUI for libmapper network
=========================================

- Authors: Stephen Sinclair, Joseph Malloch, Aaron Krajeski & Jon Wilansky
- Email: [dot_mapper@googlegroups.com](mailto:dot_mapper@googlegroups.com)
- Discussion: [https://groups.google.com/forum/#!forum/dot_mapper](https://groups.google.com/forum/#!forum/dot_mapper)
- Web: [http://libmapper.org](http://libmapper.org)

During a variety of projects we have found that the "mapping" task – in which correspondences are designed between sensor/gesture signals and the control parameters of sound synthesizers – is by far the most challenging aspect of digital musical instrument design, especially when attempted in collaborative settings. We have developed tools for supporting this task, including the [Digital Orchestra Toolbox](http://idmil.org/dot) for MaxMSP and the software library [libmapper](https://github.com/libmapper/libmapper). The latter project enables the creation of a network of distributed "devices" which may be sources of real-time control data (instruments) and/or destinations for control data (e.g. sound synthesizers). The software library handles device discovery, stream translation (e.g. type coercion, padding) and network transportation, but does not attempt to create mappings automatically. Instead, the mapping designer(s) command the library to create maps between signals, usually using a graphical user interface to interact with the mapping network. To date, GUIs for libmapper have been implemented in MaxMSP, Javascript/HTML5, and Python/wxWidgets. **Webmapper** is one of these interfaces, implemented as a Python back-end using libmapper's Python bindings to interact with the libmapper network, and a front-end running in a web browser as HTML and Javascript. 

All libmapper GUIs function as “dumb terminals” — no handling of mapping commands takes place in the GUI, but rather they are only responsible for representing the current state of the network links and maps, and issuing commands on behalf of the user. This means that an arbitrary number of GUIs can be open simultaneously supporting both remote network management and collaborative creation and editing during the mapping task.

### GUI functionality:

* browsing active devices and their signals
* drag-and-drop mapping connections
* mode and function editor for maps
* collaborative undo/redo
* filtering parameter lists by OSC prefix or string-matching
* saving and loading mapping sets (including consideration of mapping transportability per the GDIF project)
* multiple "views" of the mapping network, using different visualization techniques

### To run:

1. Build and install [libmapper](https://github.com/libmapper/libmapper)
1. Copy `_mapper.so` and `mapper.py` from the directory /libmapper/swig into /webmapper directory.
2. Run webmapper.py from terminal
3. Terminal will display "serving at port #####"
4. Open a browser
5. Type "localhost:#####" into the address bar, where ##### is the same string of numbers displayed in terminal

### A note on saving and loading:

As of now saving and loading work via a naïve approach. In the list view (currently the only view tested for saving and loading) the `save` button saves data for the active tab. Similarly, loading only loads maps for signals in the active tab. Our development roadmap includes improvements to the save/load functionality.


Views:
------

We have explored several alternative visualization and interaction techniques, which allow more informed and flexible interaction with the mapping network. Crucially, we believe that there is no need for a single “correct” user interface; rather, different network representations and interaction approaches may be useful to different users, for different mapping tasks, or at different times.

**Webmapper** includes four different views: `List`, `Grid`, `Hive`, and `Balloon`. These views can be enabled by choosing them from the "Display" menu located on the top left of the running GUI.


### List view:

The primary view used in our mapping GUIs is based on the common structure of diagrams used to describe DMI mapping in the literature – a bipartite graph representation of the maps, in which sources of data appear on the left-hand side of the visualization and destinations or sinks for data appear on the right. Lines representing inter-device links and inter-signal maps may be drawn between the entities on each side, and properties are set by first selecting the map(s) to work on and then setting properties in a separate “edit bar”. The GUI contains multiple "tabs": the leftmost tab always displays the network overview (links between devices) and subsequent tabs provide sub-graph representations of the maps belonging to a specific linked device.

**Shortcut keys:**

* 'c' : Connect/Map selected devices/signals
* 'delete': Delete selected links/maps
* 'cmd+a'    : Select all links/maps
* 'alt+tab' : Change tab to the right
* 'alt+shift+tab' : Change tab to the left
* hold down 'm' while connecting to create muted maps


### Grid View (tested on Chrome only):

There are 2 grids. The left side is the DEVICES grid, the right is the SIGNALS grid. To view signals in the SIGNALS grid: select cells (or labels) on the DEVICES grid and press the "Add"/"Remove" button ('a'/'s' keyboard shortcut). This will include/exclude the selected devices in the SIGNALS grid. Vertical/horizontal lines indicate if the device is included. 

You can use the keyboard arrows to move the selected cell around. All keyboard shortcuts affect the 'active' grid, indicated by the little square in the upper left corner of the grid.

You can save the current view in the SIGNALS grid as a 'preset' using the "SaveNew" button on the top right hand side. Note that changes to the current preset will not be remembered unless you press the "Update" button.

Note the keyboard shortcuts for changing the active grid, moving the selected cell, toggling cells, loading presets, … they enable you to use the interface much more efficiently:

**Shortcut keys:**

* click on cell: set the cell as selected
* COMMAND click a cell: select multiple cells
* arrows: move selected cell
* SHIFT + arrows: move selected cell by 3
* space: toggle selected cell(s)
* c: connect selected cell(s)
* d: disconnect selected cell(s)

* CTRL +: zoom in on active grid
* CTRL -: zoom out on active grid
* CTRL 0: zoom-to-fit on active grid
* CTRL 1: switch to SPLIT view
* CTRL 2: switch to DEVICES only view
* CTRL 3: switch to SIGNALS only view

* ALT leftArrow: set DEVICES grid as active
* ALT rightArrow: set SIGNALS grid as active
* ALT up/down arrows: cycle through presets


### Hive plot view:


The hive plot is a method for visualizing networks. In this view, the upper half of the plot is designated for source devices, and the lower for destinations. In view mode 1, an adapted hive plot, each device is given its own axis. In view mode 2, a traditional hive plot, source/destination devices are grouped along a single axis. 

Although designed mainly as an aid for visualization, this view also provides the basic functionality to configure maps. Mouse over a device or signal in the list on the left hand side (or in the plot) to highlight its connections. Select signals by clicking its name in the list (or its node in the plot). Once a source and destination signal is selected, you can create or remove the map by clicking on the blue bar at the bottom (or by using the keyboard shortcuts). 

Connections on specific devices can be shown or hidden from view using the checkboxes in the list next to the device names.

**Shortcut keys:**

* c: connect selected cell(s)
* d: disconnect selected cell(s)

* CTRL 1: switch to view mode 1 (adapted Hive plot)
* CTRL 2: switch to view mode 2 (Hive plot)


### Balloon plot view:

Balloon plot is brand new and has not yet been thoroughly tested.





