# WebMapper News

## Version 2.4.6

We are pleased to announce the release of version 2.4.6 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware.

Changes since the last release include:

- Filter local monitor signals at Python backend instead of js frontend; use custom `display` property instead of device name to indicate whether signals should be forwarded to front end.
- Small fix for signal property formatting in Console View.
- updates for libmapper v2.4.6 (removed deprecated enum values)

This version updates the package dependency requirements to [libmapper 2.4.6](https://pypi.org/project/libmapper/2.4.6/) and [mappersession 0.0.15](https://pypi.org/project/mappersession/0.0.15/).

## Version 2.4.5

We are pleased to announce the release of version 2.4.5 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware.

Changes since the last release include:

- Enabled switching network interfaces on Windows. This feature updates the package dependency requirements to [libmapper 2.4.5](https://pypi.org/project/libmapper/2.4.5/) and [mappersession 0.0.14](https://pypi.org/project/mappersession/0.0.14/). Translation to human-friendly interface names is now handled by libmapper.

## Version 2.4.4

We are pleased to announce the release of version 2.4.4 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware.

Changes since the last release include:

-  Improvements to drawing of maps in the Hive Plot and Paralle Coordinate Plot views. These improvments are especially noticeable when drawing convergent maps.
- Revision of the Saver/Loader widget in the top toolbar. This widget now displays all active mapping sessions in a drop-down menu, and enables 'unloading' each session individually.
-  Fixes for display of vector signal extrema (minimum and maximum values) in the mouseover metadata table. 

## Version 2.4.3

We are pleased to announce the release of version 2.4.3 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware.

Since the release of version 2.3, a large number of improvements and bugfixes have been performed. Some of the more important changes are outlined below:

- the Python backend was ported to use the new [mappersession](https://github.com/libmapper/mappersession) module. This work included standardisation of the mapping session file structure, improvements to loading legacy file versions, and the addition of libmapper control signals for loading and unloading session files. Some of the new features supported by mappersession are not yet used by webmapper but will support future improvements.
- simplification of the signal table view by moving some signal metadata into a tooltip. Configuration of which metadata are included in the table will be a user-defined preference in future versions.
- A simple plot of live signal values can be invoked from the List view.
- improvements to the CI and build scripts
- numerous small bugfixes and visual tweaks

## Version 2.3

We are pleased to announce the release of version 2.3 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware. This marks the first numbered (rather than dated) release of WebMapper, which will now be released regularly in sync with the libmapper repository.

Since the last release in 2019, a large number of improvements and bugfixes have been performed. Some of the more important changes are outlined below:

* WebMapper was ported to use the new libmapper bindings for Python (using ctypes). The bindings are no longer bundled with WebMapper and should be installed using PyPi or copied from the libmapper repository.
* A graphical curve editor was added for designing map expressions. It is invocable using the 'curve' button on the expression editor.
* The expression editor was ported to use codemirror, enabling better layout and syntax highlighting.
* Signal values can now be set directly by double-clicking on a signalTable entry (e.g. in List view) and typing a value into the text box that appears. Supports scalar and vector values with elements separated by commas.
* The internal expression generator for convergent maps was extended to support vector signals.
* The appearance of maps was changed to better present their properties: muted maps are now translucent and instanced maps use dashed paths.
* Drawing of objects was optimised resulting in significantly smoother updates with large numbers of signals.
* A .spec file is now included for building WebMapper as an application with PyInstaller
