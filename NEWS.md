# WebMapper News

## Version 2.3

We are pleased to announce th release of version 2.3 of WebMapper, a Python + HTML5 user interface for exploring and managing the distributed network formed by [libmapper](http://www.libmapper.org/)-enabled software and hardware. This marks the first numbered (rather than dated) release of WebMapper, which will now be released regularly in sync with the libmapper repository.

Since the last release in 2019, a large number of improvements and bugfixes have been performed. Some of the more important changes are outlined below:

* WebMapper was ported to use the new libmapper bindings for Python (using ctypes). The bindings are no longer bundled with WebMapper and should be installed using PyPi or copied from the libmapper repository.
* A graphical curve editor was added for designing map expressions. It is invocable using the 'curve' button on the expression editor.
* The expression editor was ported to use codemirror, enabling better layout and syntax highlighting.
* Signal values can now be set directly by double-clicking on a signalTable entry (e.g. in List view) and typing a value into the text box that appears. Supports scalar and vector values with elements separated by commas.
* The internal expression generator for convergent maps was extended to support vector signals.
* The appearance of maps was changed to better present their properties: muted maps are now translucent and instanced maps use dashed paths.
* Drawing of objects was optimised resulting in significantly smoother updates with large numbers of signals.
* A .spec file is now included for building WebMapper as an application with PyInstaller
