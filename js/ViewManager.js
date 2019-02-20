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

        this.srcregexp = null;
        this.dstregexp = null;

        // remove all previous DOM elements
        $(this.container).empty();
        this._add_canvas();
        this._add_display_tables();
        this._selection_handlers();
        this._keyboard_handlers();
        this._add_database_callbacks();

        let self = this;
        this.database.devices.each(function(dev) { self._update_devices(dev, 'added'); });
        this.database.maps.each(function(map) { self._update_maps(map, 'added'); });

        this.switch_view('chord');
    }

    zoom(x, y, delta) {
        this.view.zoom(x, y, delta);
    }

    pan(x, y, delta_x, delta_y) {
        this.view.pan(x, y, delta_x, delta_y);
    }

    resetPanZoom() {
        this.view.resetPanZoom();
    }

    on_resize() {
        this.frame = fullOffset($(this.container)[0]);
        this.view.resize(this.frame);
        this.tooltip.hide();
    }

    filterSignals(searchbar, text) {
        // need to cache regexp here so filtering works across view transitions
        if (searchbar == 'srcSearch') {
            this.srcregexp = text ? new RegExp(text, 'i') : null;
            this.view.filterSignals('src', text.length ? text : null);
        }
        else {
            this.dstregexp = text ? new RegExp(text, 'i') : null;
            this.view.filterSignals('dst', text.length ? text : null);
        }
    }

    loadFile(file) {
        if (this.view && this.view.type() == 'chord')
            this.view.stageFile(file);
    }

    switch_view(viewType) {
        if (this.view) {
            if (this.view.type == viewType) {
                // already on correct view
                return;
            }
            // call cleanup for previous view
            this.view.cleanup();
        }

        switch (viewType) {
            case 'balloon':
                this.view = new BalloonView(this.frame, this.tables, this.canvas,
                                            this.database, this.tooltip);
                break;
            case 'canvas':
                this.view = new CanvasView(this.frame, this.tables, this.canvas,
                                           this.database, this.tooltip);
                break;
            case 'graph':
                this.view = new GraphView(this.frame, this.tables, this.canvas,
                                          this.database, this.tooltip);
                break;
            case 'grid':
                this.view = new GridView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip);
                break;
            case 'parallel':
                this.view = new ParallelView(this.frame, this.tables, this.canvas,
                                             this.database, this.tooltip);
                break;
            case 'hive':
                this.view = new HiveView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip);
                break;
            case 'link':
                this.view = new LinkView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip);
                break;
            case 'chord':
                this.view = new ChordView(this.frame, this.tables, this.canvas,
                                          this.database, this.tooltip);
                break;
            case 'console':
                this.view = new ConsoleView(this.frame, this.tables, this.canvas,
                                            this.database, this.tooltip);
                break;
            case 'list':
            default:
                this.view = new ListView(this.frame, this.tables, this.canvas,
                                         this.database, this.tooltip);
                break;
        }

        this.view.update();

        // unhighlight all view select buttons
        $('.viewButton').removeClass("viewButtonsel");
        // highlight the select button for the new view
        $('#'+viewType+'Button').addClass("viewButtonsel");
    }

    _add_database_callbacks() {
        let self = this;
        this.database.clear_callbacks();
        this.database.add_callback(function(event, type, obj) {
            if (event == 'removing') {
                // remove maps immediately to avoid svg arrow animation bug
                if (type == 'map') remove_object_svg(obj, 1); 
                remove_object_svg(obj);
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
            dev.signals.each(function(sig) {
                this._update_signals(sig, 'added', false);
            });
            this.view.update('devices');
        }
        else if (event == 'removed')
            this.view.update('devices');
    }

    _update_signals(sig, event, repaint) {
        if (event == 'added' && !sig.view) {
            sig.position = position(null, null, this.frame);
            if (repaint)
                this.view.update('signals');
        }
        else if (event == 'modified' || event == 'removed')
            this.view.update('signals');
    }

    _update_links(link, event) {
        this.view.update('links');
    }

    _update_maps(map, event) {
        switch (event) {
            case 'added':
                if (!map.view)
                    this.view.update('maps');
                break;
            case 'modified':
                if (map.view) {
                    if (map.selected)
                        $('#container').trigger("updateMapPropertiesFor", map.key);
                    this.view.update('maps');
                }
                break;
            case 'removed':
                this.view.update('maps');
                break;
        }
    }

    _selection_handlers() {
        let self = this;
        $('#svgDiv').on('mousedown', function(e) {
            if (e.shiftKey == false) {
                deselectAllMaps(self.tables);
            }
            var escaped = false;

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            // check for edge intersections around point for 'click' selection
            let updated = false;
            self.database.maps.each(function(map) {
                if (!map.view || map.selected)
                    return;
                if (   edge_intersection(map.view, x1-3, y1-3, x1+3, y1+3)
                    || edge_intersection(map.view, x1-3, y1+3, x1+3, y1-3)) {
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
                self.database.maps.each(function(map) {
                    if (!map.view || map.selected)
                        return;
                    if (edge_intersection(map.view, x1, y1, x2, y2)) {
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
                    if (self.view.type == 'console') break;
                    self.database.maps.each(function(map) {
                        if (map.selected)
                        {
                            $('#container').trigger('unmap', [map.src.key, map.dst.key]);
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
                case 65:
                    if (e.metaKey == true) {
                        e.preventDefault();
                        console.log('should add tab');
                    }
                    break;
                case 27:
                    self.view.escape();
                    break;
            }
        });
    }
}
