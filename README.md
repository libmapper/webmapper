# <img style="padding:10px;float:left" src="./images/libmapper_logo_black_512px.png" width="75px"> Webmapper: a browser-based interface for administration of control-mapping networks

<br/>

- Contributors: Stephen Sinclair, Joseph Malloch, Vijay Rudraraju, Aaron Krajeski, Jon Wilansky, Johnty Wang, Travis West
- Resources: [Discussion list][group], [libmapper documentation][libmapper]

During a number of projects we have found that the "mapping" task – in which correspondences are designed between sensor/gesture signals and the control parameters of media synthesizers – is by far the most challenging aspect of designing digital musical instrument or other interactive systems. This problem becomes even worse when attempted in collaborative settings, since collaborators often have different perspectives, vocabularies and tools.

We have developed tools for supporting this task, including the [Digital Orchestra Toolbox][DOT] for MaxMSP and the software library [libmapper][libmapper]. The latter project enables the creation of a network of distributed "devices" which may be sources of real-time control data (instruments) and/or destinations for control data (e.g. sound synthesizers). The software library handles device discovery, stream translation (e.g. type coercion, vector padding) and network transportation, but does not attempt to create mappings automatically. Instead, the mapping designer(s) use the library to create maps between distributed signals, usually using a graphical user interface to interact with the mapping network. To date, GUIs for libmapper have been implemented in MaxMSP, Javascript/HTML5, C++/Qt, and Python/wxWidgets. **Webmapper** is one of these interfaces, implemented as a Python back-end using libmapper's Python bindings to interact with the libmapper network, and a front-end running in a web browser as HTML and Javascript.

### Functionality

Webmapper aims to support the mapping task in three ways:

1. Aiding discovery and exploration of active devices and their signals. Currently 8 different "views" of the mapping network are available, each using a different visualization approach.
2. Providing an interactive graphical interface for creating, editing, and destroying data-streaming connections ("maps") between signals. 
3. Supporting saving and loading of mapping sets, including support for mapping transportability (cf. the [GDIF project][GDIF])

All libmapper GUIs function as “dumb terminals” — no handling of mapping commands takes place in the GUI, but rather they are only responsible for representing the current state of the network, and issuing commands on behalf of the user. This means that an arbitrary number of GUIs can be open simultaneously supporting both remote network management and collaborative creation and editing during the mapping task.

### Currently missing:

* collaborative undo/redo

### To run:

1. Build and install [libmapper][libmapper]
2. Copy `_mapper.so` and `mapper.py` from the directory /libmapper/swig into /webmapper directory.
3. Run webmapper.py from terminal
4. Terminal will display "serving at port #####"
5. A browser window should be opened automatically and directed to the correct port.

If the browser doesn't open, open it manually and type "localhost:#####" into the address bar, where ##### is the same string of numbers displayed in the terminal

### To build standalone application:

1. $ python setup.py py2app

### Saving and loading:

<img height="60px" style="padding:0px;vertical-align:middle" src="./doc/screenshots/file_io.png">

Released versions of Webmapper use "naïve" file loading, in which maps specifications loaded from file are matched against all of the devices currently active on the network. This is intended to support *transportability* of mapping specifications between similar devices if their parameter spaces are structured similarly (cf. the [GDIF project][GDIF]). It also ensures that files will still load if a device receives a different ordinal id than the one used when the file was saved. Unfortunately, this naïve approach may also cause unintended consequences if a file is loaded when multiple instances of an involved device are present – to avoid these problems, see [hiding devices](#hiding_devices) in the description of the Chord View below.

#### In development: map staging

We are working on a new functionality called *map staging*. While the previous naïve approach loaded saved maps against all of the device names in the current tab, loading a file now switches to a new view showing only devices and network links. The file is parsed to retrieve the number of devices involved, and an interactive object is displayed allowing the user to assign device representations from the file to devices that are active on the network. Once the devices have been assigned, clicking on the central file representation launches an attempt to recreate the saved maps.

### Searching/filtering signals

<img height="60px" style="padding:0px;vertical-align:middle" src="./doc/screenshots/signal_filter.png">

Text boxes are provided for filtering source and destination signals by name.

### Editing map properties

<img height="60px" style="padding:0px;vertical-align:middle" src="./doc/screenshots/map_properties.png">

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

Lines representing inter-signal maps may be drawn between signals using drag-and-drop, and properties are set by first selecting the map(s) to work on and then setting properties using the map property editor described above.  Maps can be selected by either clicking on them or 'crossing' them by clicking and dragging through the map. Hold down the `Shift` key to select multiple maps.

| Shortcut              | Action                    |
| --------------------- | ------------------------- |
| cmd + 1-8             | Switch view               |
| cmd + O               | Open file                 |
| cmd + S               | Save file                 |
| cmd + A               | Select all displayed maps |
| delete, backspace     | Remove selected maps      |
| +, -                  | Increase/decrease zoom    |
| ←, ↑, →, ↓            | Pan canvas                |
| cmd + 0               | Reset pan and zoom        |
| M                     | Toggle muting for selected maps, or hold down the while creating a new map to set its initial `muted` property to `true`.

#### Scrolling and panning

Scroll and pan using using multitouch gestures, mouse scroll wheel or arrow keys. Scrolling over signal tables will be contrained to the table only, while scrolling and panning over canvas areas is will affect the entire display.

#### Zooming

Zoom using multitouch pinch and spread gestures or the `+`/`-` keys. Applying zoom commands over tables will zoom the table only, while zoom commands applied over canvas areas will zoom the entire display.

## Color:

Color is used throughout the UI for differentiating devices and their signals. The color used to display a given device is generated from a hash of the device's unique name. This means that although this UI displays devices that are instantiated ad hoc in a distributed network, the color for a given device will remain the same no matter how many times it disappears and reappears.  The hashing algorithm is designed so that instances of the same device will have very similar (but distinguishable) colors.

## Views:

<img height="60px" style="padding:0px;vertical-align:middle" src="./doc/screenshots/view_selector.png">

We have explored several alternative visualization and interaction techniques, which allow more informed and flexible interaction with the mapping network. Crucially, we believe that there is no need for a single “correct” user interface; rather, different network representations and interaction approaches may be useful to different users, for different mapping tasks, or at different times.

**Webmapper** currently includes eight different views. Following is a brief description of each view, including any view-specific interactions. For each, the name of the view is displayed along with the view's icon representation in the view selector widget, followed by the shortcut key displayed as `Command-N`.

### <img style="padding:0px;vertical-align:middle" src="./images/chord_icon_black.png" width="25px"> Chord view

* Shortcut: `Command-1`
* Status: **development**

This view displays only devices and network links between them. It can be used to gain an overview of the mapping network. Hovering over a device or link representation will cause an information box to appear displaying additional metadata.

#### <a name="hiding_devices">Hiding devices</a>

Devices can be "hidden" from the rest of the views by clicking on them. This will cause the device representation to become gray. While "hidden", a device and its signals will not appear in any of the remaining views, and its signals will not be included when calculating matches for file-loading. Clicking again on a hidden device will return it to an unhidden state.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/chord.png">

### <img style="padding:0px;vertical-align:middle" src="./images/list_icon_black.png" width="25px"> List view

* Shortcut: `Command-2`
* Status: **stable**

The primary view used in our mapping GUIs is based on the common structure of diagrams used to describe DMI mapping in the literature – a bipartite graph representation of the maps, in which sources of data appear on the left-hand side of the visualization and destinations or sinks for data appear on the right.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/list.png">

### <img style="padding:0px;vertical-align:middle" src="./images/grid_icon_black.png" width="25px"> Grid view

* Shortcut: `Command-3`
* Status: **development**

In this view, `source` signals are listed along the left side of a grid, while `destination` signals are listed along the top. Maps connecting the signals are drawn as triangles at the intersection of their sources and destination, with the point of the triangle indicating the direction of dataflow: **up** for maps flowing from a signal in the left table to a signal in the top table, or **left** for maps flowing from the top to the left. In the case of maps involving only signals in one table, there is no intersection point and the maps are drawing using directed edges as in the **List View**.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/grid.png">


### <img style="padding:0px;vertical-align:middle" src="./images/canvas_icon_black.png" width="25px"> Canvas view

* Shortcut: `Command-4`
* Status: **development**

The canvas view is loosely modeled after the UI for the application [Input Configurator (ICon)][ICon] by Pierre Dragecevic and Stéphane Huot. In this view, both input and output signals appear in a list on the left side, and can be dragged into the main canvas area.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/canvas.png">

#### View-specific interactions

* Drag a signal from the list on the left to create an associated canvas object.
* Click and drag the middle of a canvas object to reposition it.
* Drag a canvas object back to the table on the left to remove it from the canvas.
* Click and drag the right or left edges of a canvas object to create a map. Drop the other end of the map on the desired signal.

### <img style="padding:0px;vertical-align:middle" src="./images/graph_icon_black.png" width="25px"> Graph view

* Shortcut: `Command-5`
* Status: **development**

The graph view plots signals on a 2D graph, with x and y axes chosen by the
user from the signals' properties. Interestingly, some signal properties
(such as min and max) may have vector values, meaning that a given signal
may have more than one location on the graph.

<img width="49%" style="padding:0px" src="./doc/screenshots/graph.png">
<img width="49%" style="float:right;padding:0px" src="./doc/screenshots/graph-fd.png">

#### View-specific interactions

* Choose the property to be displayed on the X and Y axes by clicking on the axis label and choosing a property from the dropdown menu. If `none` is chosen, a force-directed layout will be applied to that axis.  A fully force-directed plot can be created by choosing `none` for both axes.

### <img style="padding:0px;vertical-align:middle" src="./images/hive_icon_black.png" width="25px"> Hive plot view

* Shortcut: `Command-6`
* Status: **development**

In this view, each device is given its own axis arranged radially. Signals belonging to a device are displayed as nodes distributed evenly along the device axis.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/hive.png">

### <img style="padding:0px;vertical-align:middle" src="./images/parallel_icon_black.png" width="25px"> Parallel coordinate view

* Shortcut: `Command-7`
* Status: **development**

In this view, each device is given its own axis arranged vertically in parallel. Signals belonging to a device are displayed as nodes distributed evenly along the device axis.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/parallel.png">

### <img style="padding:0px;vertical-align:middle" src="./images/console_icon_black.png" width="25px"> Console view

* Shortcut: `Command-8`
* Status: **stable**

This view presents a "console" for performing text-based interaction with the mapping network.  A separate window on the right displays the currently-active maps.

<img width="60%" style="display:block;margin-left:auto;margin-right:auto;padding:0px" src="./doc/screenshots/console.png">

## Working Offline

Status: planning

[libmapper]: https://github.com/libmapper/libmapper
[GDIF]: http://www.idmil.org/projects/gdif
[ICon]: http://inputconf.sourceforge.net/
[DOT]: http://idmil.org/dot
[group]: https://groups.google.com/forum/#!forum/dot_mapper
