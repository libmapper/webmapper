<img style="padding:10px;float:left" src="./images/libmapper_logo_black_512px.png" width="75px">

# Webmapper: a browser-based interface for administration of control-mapping networks

<br/>

- Contributors: Stephen Sinclair, Joseph Malloch, Vijay Rudraraju, Aaron Krajeski, Jon Wilansky, Johnty Wang, Travis West
- Email: [dot_mapper@googlegroups.com](mailto:dot_mapper@googlegroups.com)
- Discussion: [https://groups.google.com/forum/#!forum/dot_mapper](https://groups.google.com/forum/#!forum/dot_mapper)
- Web: [http://libmapper.org](http://libmapper.org)

**Note: this document is not complete!**


During a number of projects we have found that the "mapping" task – in which correspondences are designed between sensor/gesture signals and the control parameters of sound synthesizers – is by far the most challenging aspect of digital musical instrument design, especially when attempted in collaborative settings. We have developed tools for supporting this task, including the [Digital Orchestra Toolbox](http://idmil.org/dot) for MaxMSP and the software library [libmapper](https://github.com/libmapper/libmapper). The latter project enables the creation of a network of distributed "devices" which may be sources of real-time control data (instruments) and/or destinations for control data (e.g. sound synthesizers). The software library handles device discovery, stream translation (e.g. type coercion, vector padding) and network transportation, but does not attempt to create mappings automatically. Instead, the mapping designer(s) use the library to create maps between distributed signals, usually using a graphical user interface to interact with the mapping network. To date, GUIs for libmapper have been implemented in MaxMSP, Javascript/HTML5, and Python/wxWidgets. **Webmapper** is one of these interfaces, implemented as a Python back-end using libmapper's Python bindings to interact with the libmapper network, and a front-end running in a web browser as HTML and Javascript.

All libmapper GUIs function as “dumb terminals” — no handling of mapping commands takes place in the GUI, but rather they are only responsible for representing the current state of the network, and issuing commands on behalf of the user. This means that an arbitrary number of GUIs can be open simultaneously supporting both remote network management and collaborative creation and editing during the mapping task.

### GUI functionality:

* browsing active devices and their signals
* drag-and-drop mapping connections
* mode and function editor for maps
* collaborative undo/redo
* filtering parameter lists by OSC prefix or string-matching
* saving and loading mapping sets, including support for mapping transportability (cf. the GDIF project)
* multiple "views" of the mapping network, using different visualization techniques

### To run:

1. Build and install [libmapper](https://github.com/libmapper/libmapper)
2. Copy `_mapper.so` and `mapper.py` from the directory /libmapper/swig into /webmapper directory.
3. Run webmapper.py from terminal
4. Terminal will display "serving at port #####"
5. A browser window should be opened automatically and directed to the correct port.

If the browser doesn't open, open it manually and type "localhost:#####" into the address bar, where ##### is the same string of numbers displayed in the terminal

### To build standalone application:

1. $ python setup.py py2app

### Saving and loading:

<img style="padding:0px;vertical-align:middle" src="./doc/screenshots/file_io.png">

Recent versions of Webmapper have added a new functionality called *map staging*. While the previous naïve approach loaded saved maps against all of the device names in the current tab, loading a file now switches to a new view showing only devices and network links. The file is parsed to retrieve the number of devices involved, and an interactive object is displayed allowing the user to assign device representations from the file to devices that are active on the network. Once the devices have been assigned, clicking on the central file representation launches an attempt to recreate the saved maps.

### Searching/filtering signals

<img style="padding:0px;vertical-align:middle" src="./doc/screenshots/signal_filter.png">

### Editing map properties

<img style="padding:0px;vertical-align:middle" src="./doc/screenshots/map_properties.png">

If a map or maps are selected, the *map property editor* becomes active. This part of the UI contains widgets for viewing and changing the properties of the selected map(s):

* **Mode:** switch between `Linear` and `Expression` mode.
* **Expression:** view and edit the expression used for processing values streaming on this map
* **Src Range:** view and edit the range (minimum and maximum values) for each source of the selected map. New maps will have these values autopopulated from the source signal's minimum and maximum properties if they are specified. When a map is in `Linear Mode`, these values will be used to calculate an interpolation function.
    * **Range Switch:** the double arrow button located between the Src Range fields can be used to swap the minimum and maximum.
    * **Calib:** Toggle `calibration` to incoming values.
* **Dst Range:** view and edit the range (minimum and maximum values) for each destination of the selected map. New maps will have these values autopopulated from the source signal's minimum and maximum properties if they are specified. When a map is in `Linear Mode`, these values will be used to calculate an interpolation function.
    * **Range Switch:** the double arrow button located between the Src Range fields can be used to swap the minimum and maximum.
    * **Boundary Modes:** buttons beside fields for minimum and maximum can be used to switch the `Boundary mode` in case the outgoing value exceeds the specified range:
        * `None` Value is passed through unchanged
        * `Mute` Value is muted if it exceeds the range boundary
        * `Clamp` Value is limited to the range boundary
        * `Fold` Value continues in opposite direction
        * `Wrap` Value appears as modulus offset at the opposite boundary

### Global Commands

Lines representing inter-signal maps may be drawn between signals using drag-and-drop, and properties are set by first selecting the map(s) to work on and then setting properties as described above.

* `cmd`+1`-`8` switch view
* `cmd`+`o` : open file
* `cmd`+`s` : save file
* `cmd`+`a`: to select all displayed maps
* `delete` or `backspace`: remove selected maps
* edit selected maps
* filter signals
* Scroll and pan using using multitouch gestures, mouse scroll wheel or arrow keys. Scrolling over signal tables will be contrained to the table only, while scrolling and panning over canvas areas is will affect the entire display.
* Zoom using multitouch pinch and spread gestures or the `+`/`-` keys. Applying zoom commands over tables will zoom the table only, while zoom commands applied over canvas areas will zoom the entire display.
* Drag and drop between signals to create maps (hold the `m` key while dropping to create a muted map). This works whether the signal representation is embedded in a table or as an individual object.
* Click or click-and-drag–across an existing map to select it.

## Views:

<img style="padding:0px;vertical-align:middle" src="./doc/screenshots/view_selector.png">

We have explored several alternative visualization and interaction techniques, which allow more informed and flexible interaction with the mapping network. Crucially, we believe that there is no need for a single “correct” user interface; rather, different network representations and interaction approaches may be useful to different users, for different mapping tasks, or at different times.

**Webmapper** currently includes seven different views. Following is a brief description of each view, including any view-specific interactions. For each, the shortcut key is displayed as `Command-N`, followed by the view's icon representation in the view selector widget.

### <img style="padding:0px;vertical-align:middle" src="./images/chord_icon_black.png" width="25px"> Chord view (file staging view) `Command-1`

**Status: development**

This view displays only devices and network links between them. It can be used to gain an overview of the mapping network, and is also used for staging saved mapping configurations onto the currently-active devices. When the `open file` dialog is used, Webmapper will automatically switch to this view and add a graphical representation of the file and its associated devices, enabling the user to choose how to assign each device referenced in the file to a running device.

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/chord.png">

### <img style="padding:0px;vertical-align:middle" src="./images/list_icon_black.png" width="25px"> List view `Command-2`

**Status: stable**

The primary view used in our mapping GUIs is based on the common structure of diagrams used to describe DMI mapping in the literature – a bipartite graph representation of the maps, in which sources of data appear on the left-hand side of the visualization and destinations or sinks for data appear on the right.

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/list.png">

### <img style="padding:0px;vertical-align:middle" src="./images/grid_icon_black.png" width="25px"> Grid view `Command-3`

**Status: development**

In this view, `source` signals are listed along the left side of a grid, while `destination` signals are listed along the top. Maps connecting the signals are drawn as triangles at the intersection of their sources and destination, with the point of the triangle indicating the direction of dataflow: **up** for maps flowing from a signal in the left table to a signal in the top table, or **left** for maps flowing from the top to the left. In the case of maps involving only signals in one table, there is no intersection point and the maps are drawing using directed edges as in the **List View**.

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/grid.png">


### <img style="padding:0px;vertical-align:middle" src="./images/canvas_icon_black.png" width="25px"> Canvas view `Command-4`

**Status: development**

The canvas view is loosely modeled after the UI for the application [Input Configurator (ICon)](http://inputconf.sourceforge.net/) by Pierre Dragecevic and Stéphane Huot. In this view, both input and output signals appear in a list on the left side, and can be dragged into the main canvas area.

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/canvas.png">

#### View-specific interactions

* Drag a signal from the list on the left to create an associated canvas object.
* Click and drag the middle of a canvas object to reposition it.
* Drag a canvas object to the grey 'trash' area in the bottom right to remove it from the canvas.
* Click and drag the right or left edges of a canvas object to create a map. Drop the other end of the map on the desired signal.

### <img style="padding:0px;vertical-align:middle" src="./images/graph_icon_black.png" width="25px"> Graph view `Command-5`

**Status: prototype**

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/graph.png">

#### View-specific interactions

* choosing axes
* switch axis polarity

### <img style="padding:0px;vertical-align:middle" src="./images/hive_icon_black.png" width="25px"> Hive plot view `Command-6`

**Status: development**

In this view, each device is given its own axis arranged radially. Signals belonging to a device are displayed as nodes distributed evenly along the device axis.

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/hive.png">

### <img style="padding:0px;vertical-align:middle" src="./images/parallel_icon_black.png" width="25px"> Parallel coordinate view `Command-7`

**Status: development**

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/parallel.png">

### <img style="padding:0px;vertical-align:middle" src="./images/console_icon_black.png" width="25px"> Console view `Command-8`

**Status: stable**

<img style="padding:0px;box-shadow:0 4px 8px 0" src="./doc/screenshots/console.png">

## Working Offline

Status: planning
