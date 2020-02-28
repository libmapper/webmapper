//++++++++++++++++++++++++++++++++++++++//
//         ViewManager Class            //
//++++++++++++++++++++++++++++++++++++++//

class ViewManager
{
    constructor(container, database, tooltip) {
        this.container = container;
        this.frame = fullOffset($(this.container)[0]);
        this.database = database;
        this.tables = { 'left': null, 'right': null };
        this.tooltip = tooltip;

        this.canvas_zoom = 1;
        this.canvas_pan = [0, 0];

        this.srcRE = null;
        this.dstRE = null;

        this.views = [];

        // remove all previous DOM elements
        $(this.container).empty();
        this._add_canvas();
        this._add_display_tables();
        this._selection_handlers();
        this._keyboard_handlers();
        this._add_database_callbacks();
        this.pie = new Pie(this.canvas, ConvergentMappingSlices);

        let self = this;
        this.database.devices.forEach(function(dev) { self._update_devices(dev, 'added'); });
        this.database.maps.forEach(function(map) { self._update_maps(map, 'added'); });

        this.currentView = null;
        setTimeout(function() {
            self.switch_view('chord');
        }, 100);
    }

    zoom(x, y, delta) {
        this.views[this.currentView].zoom(x, y, delta);
    }

    pan(x, y, delta_x, delta_y) {
        this.views[this.currentView].pan(x, y, delta_x, delta_y);
    }

    resetPanZoom() {
        this.views[this.currentView].resetPanZoom();
    }

    on_resize() {
        this.frame = fullOffset($(this.container)[0]);
        this.views[this.currentView].resize(this.frame);
        this.tooltip.hide();
    }

    filterSignals(searchbar, text) {
        // need to cache regexp here so filtering works across view transitions
        if (searchbar == 'srcSearch') {
            this.database.srcRE = text ? new RegExp(text, 'i') : new RegExp('.*');
            this.views[this.currentView].filterSignals('src');
        }
        else {
            this.database.dstRE = text ? new RegExp(text, 'i') : new RegExp('.*');
            this.views[this.currentView].filterSignals('dst');
        }
    }

    loadFile(file) {
        if (this.currentView == 'chord')
            this.views[this.currentView].stageFile(file);
    }

    switch_view(viewType) {
        if (this.currentView) {
            if (this.currentView == viewType) {
                // already on correct view
                return;
            }
            // call cleanup for previous view
            this.views[this.currentView].cleanup();
        }

        if (this.views[viewType]) {
            this.views[viewType].setup();
        }
        else {
            let view;
            switch (viewType) {
                case 'balloon':
                    view = new BalloonView(this.frame, this.tables, this.canvas,
                                           this.database, this.tooltip, this.pie);
                    break;
                case 'canvas':
                    view = new CanvasView(this.frame, this.tables, this.canvas,
                                          this.database, this.tooltip, this.pie);
                    break;
                case 'graph':
                    view = new GraphView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip, this.pie);
                    break;
                case 'grid':
                    view = new GridView(this.frame, this.tables, this.canvas,
                                        this.database, this.tooltip, this.pie);
                    break;
                case 'parallel':
                    view = new ParallelView(this.frame, this.tables, this.canvas,
                                            this.database, this.tooltip, this.pie);
                    break;
                case 'hive':
                    view = new HiveView(this.frame, this.tables, this.canvas,
                                        this.database, this.tooltip, this.pie);
                    break;
                case 'chord':
                    view = new ChordView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip, this.pie);
                    break;
                case 'console':
                    view = new ConsoleView(this.frame, this.tables, this.canvas,
                                           this.database, this.tooltip, this.pie);
                    break;
                case 'list':
                default:
                    view = new ListView(this.frame, this.tables, this.canvas,
                                        this.database, this.tooltip, this.pie);
                    break;
            }
            this.views[viewType] = view;
        }

        this.views[viewType].update();

        this.currentView = viewType;

        // unhighlight all view select buttons
        $('.viewButton').removeClass("viewButtonsel");
        // highlight the select button for the new view
        $('#'+viewType+'Button').addClass("viewButtonsel");
    }

    showCurveGenerator(props, onGenerated) {
        new CurveGenerator(props, onGenerated);
    }

    _add_database_callbacks() {
        let self = this;
        this.database.clear_callbacks();
        this.database.add_callback(function(event, type, obj) {
            if (event == 'removing') {
                if (type == 'map' && obj.view)
                    obj.view.remove();
                remove_object_svg(obj, 0);
                return;
            }
            switch (type) {
                case 'device':
                    self._update_devices(obj, event);
                    break;
                case 'link':
                    self._update_links(obj, event);
                    break;
                case 'signal':
                    self._update_signals(obj, event, true);
                    break;
                case 'map':
                    self._update_maps(obj, event);
                    break;
            }
        });
    };

    _add_display_tables() {
        this.tables.left  = new SignalTable($('#container')[0], 'left', this.frame, this.database);
        this.tables.right = new SignalTable($('#container')[0], 'right', this.frame, this.database);
    }

    _add_canvas() {
        $('#container').append(
            "<div id='svgDiv' class='svgDiv'>"+
            "</div>");
        this.canvas = Raphael($('#svgDiv')[0], '100%', '100%');
    };

    _update_devices(dev, event) {
        if (event == 'added' && !dev.view) {
            dev.signals.forEach(function(sig) {
                this._update_signals(sig, 'added', false);
            });
            this.views[this.currentView].update('devices');
        }
        else if (event == 'removed')
            this.views[this.currentView].update('devices');
    }

    _update_signals(sig, event, repaint) {
        if (event == 'added' && !sig.view) {
            sig.position = position(null, null, this.frame);
            if (repaint)
                this.views[this.currentView].update('signals');
        }
        else if (event == 'modified' || event == 'removed')
            this.views[this.currentView].update('signals');
    }

    _update_links(link, event) {
        this.views[this.currentView].update('links');
    }

    _update_maps(map, event) {
        switch (event) {
            case 'added':
                if (!map.view)
                    this.views[this.currentView].update('maps');
                break;
            case 'modified':
                if (map.view) {
                    if (map.selected)
                        $('#container').trigger("updateMapPropertiesFor", map.key);
                    this.views[this.currentView].update('maps');
                }
                break;
            case 'removed':
                this.views[this.currentView].update('maps');
                break;
        }
    }

    _selection_handlers() {
        let self = this;
        $('#svgDiv').on('mousedown', function(e) {
            if (self.views[self.currentView].dragging)
                return;
            $('#container').trigger("sendCachedProperty");
            if (e.shiftKey == false) {
                deselectAllMaps(self.tables);
            }
            var escaped = false;

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            if (self.currentView == 'grid') {
                // svg canvas has hidden offset
                svgPos.left -= self.tables.left.expandWidth;
                svgPos.top -= self.tables.right.expandWidth;
            }
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            // check for edge intersections around point for 'click' selection
            let updated = false;
            self.database.maps.forEach(function(map) {
                if (!map.view || map.selected)
                    return;
                if (   map.view.edge_intersection(x1-3, y1-3, x1+3, y1+3)
                    || map.view.edge_intersection(x1-3, y1+3, x1+3, y1-3)) {
                    updated = select_obj(map);
                }
            });
            if (updated) $('#container').trigger("updateMapProperties");

            let stop = false;
            // Moving about the canvas
            $('#svgDiv').on('mousemove.drawing', function(moveEvent) {
                if (stop == true || escaped == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                // check for edge intersections for 'cross' selection
                updated = false;
                self.database.maps.forEach(function(map) {
                    if (!map.view || map.selected)
                        return;
                    if (map.view.edge_intersection(x1, y1, x2, y2)) {
                        updated |= select_obj(map);
                    }
                });

                e.stopPropagation();

                if (updated) $('#container').trigger("updateMapProperties");

                x1 = x2;
                y1 = y2;
            });
            $('#svgDiv').one('mouseup.drawing', function(mouseUpEvent) {
                stop = true;
            });
        });
    }

    _keyboard_handlers() {
        let self = this;
        $('body').on('keydown.list', function(e) {
            switch (e.which) {
                case 8:
                case 46:
                    // Prevent the browser from going back a page
                    // but NOT if you're focus is an input and deleting text
                    if (!$(':focus').is('input')) {
                        e.preventDefault();
                    }
                    /* delete */
                    // do not allow 'delete' key to unmap in console view
                    if (self.currentView == 'console') break;
                    self.database.maps.forEach(function(map) {
                        if (map.selected)
                        {
                            let srcs = map.srcs.map(s => s.signal.key);
                            mapper.unmap(srcs, map.dst.signal.key);
                            self.tooltip.hide();
                        }
                    });
                    deselectAllMaps(self.tables);
                    break;
                case 65:
                    if (e.metaKey == true) { // Select all 'cmd+a'
                        e.preventDefault();
                        select_all_maps();
                    }
                    break;
                case 27:
                    self.views[self.currentView].escape();
                    break;
            }
        });
    }
}
