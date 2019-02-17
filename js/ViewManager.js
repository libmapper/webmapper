//++++++++++++++++++++++++++++++++++++++//
//         ViewManager Class            //
//++++++++++++++++++++++++++++++++++++++//

function ViewManager(container, database, tooltip)
{
    let self = this;
    
    let frame = null;
    let canvas = null;
    let tables = { 'left': null, 'right': null };
    this.tooltip = tooltip;

    let duration = 1000;

    var canvas_zoom = 1;
    var canvas_pan = [0, 0];

    var srcregexp = null;
    var dstregexp = null;

    this.view = null;
    
    this.draw = function() {
        //
    };

    this.loadFile = function(file) {
        if (this.view && this.view.type() == 'chord')
            this.view.stageFile(file);
    }

    this.switch_view = function(viewType) {
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
                this.view = new BalloonView(frame, tables, canvas, database, tooltip);
                break;
            case 'canvas':
                this.view = new CanvasView(frame, tables, canvas, database, tooltip);
                break;
            case 'graph':
                this.view = new GraphView(frame, tables, canvas, database, tooltip);
                break;
            case 'grid':
                this.view = new GridView(frame, tables, canvas, database, tooltip);
                break;
            case 'parallel':
                this.view = new ParallelView(frame, tables, canvas, database, tooltip);
                break;
            case 'hive':
                this.view = new HiveView(frame, tables, canvas, database, tooltip);
                break;
            case 'link':
                this.view = new LinkView(frame, tables, canvas, database, tooltip);
                break;
            case 'chord':
                this.view = new ChordView(frame, tables, canvas, database, tooltip);
                break;
            case 'console':
                this.view = new ConsoleView(frame, tables, canvas, database, tooltip);
                break;
            case 'list':
            default:
                this.view = new ListView(frame, tables, canvas, database, tooltip);
                break;
        }

        this.view.update();

        // unhighlight all view select buttons
        $('.viewButton').removeClass("viewButtonsel");
        // highlight the select button for the new view
        $('#'+viewType+'Button').addClass("viewButtonsel");
    }

    resize_elements = function(duration) {
        if (self.view)
            self.view.resize(frame);

        canvas_zoom = 1;
        canvas_pan = [0, 0];
        canvas.setViewBox(0, 0, frame.width * canvas_zoom,
                          frame.height * canvas_zoom, false);
        self.tooltip.hide();
    }

    add_database_callbacks = function() {
        database.clear_callbacks();
        database.add_callback(function(event, type, obj) {
            if (event == 'removing') {
                // remove maps immediately to avoid svg arrow animation bug
                if (type == 'map') remove_object_svg(obj, 1); 
                remove_object_svg(obj);
                return;
            }
            switch (type) {
                case 'device':
                    update_devices(obj, event);
                    break;
                case 'link':
                    update_links(obj, event);
                    break;
                case 'signal':
                    update_signals(obj, event, true);
                    break;
                case 'map':
                    update_maps(obj, event);
                    break;
            }
        });
    };

    function add_display_tables() {
        tables.left  = new SignalTable($('#container')[0], 'left', frame, database);
        tables.right = new SignalTable($('#container')[0], 'right', frame, database);
    }

    function add_canvas() {
        $('#container').append(
            "<div id='svgDiv' class='links'>"+
            "</div>");
        canvas = Raphael($('#svgDiv')[0], '100%', '100%');
    };

    function update_devices(dev, event) {
        if (event == 'added' && !dev.view) {
            dev.signals.each(function(sig) {
                update_signals(sig, 'added', false);
            });
            self.view.update('devices');
        }
        else if (event == 'removed')
            self.view.update('devices');
    }

    function update_signals(sig, event, repaint) {
        if (event == 'added' && !sig.view) {
            sig.position = position(null, null, frame);
            if (repaint)
                self.view.update('signals');
        }
        else if (event == 'modified' || event == 'removed')
            self.view.update('signals');
    }

    function update_links(link, event) {
        self.view.update('links');
    }

    function update_maps(map, event) {
        switch (event) {
            case 'added':
                if (!map.view)
                    self.view.update('maps');
                break;
            case 'modified':
                if (map.view) {
                    if (map.selected)
                        $('#container').trigger("updateMapPropertiesFor", map.key);
                    self.view.update('maps');
                }
                break;
            case 'removed':
                self.view.update('maps');
                break;
        }
    }

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
                database.maps.each(function(map) {
                    if (map.selected)
                    {
                        $('#container').trigger('unmap', [map.src.key, map.dst.key]);
                        tooltip.hide();
                    }
                });
                deselectAllMaps(tables);
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

    this.zoom = function(x, y, delta) {
        this.view.zoom(x, y, delta);
    }

    this.pan = function(x, y, delta_x, delta_y) {
        this.view.pan(x, y, delta_x, delta_y);
    }

    this.resetPanZoom = function() {
        this.view.resetPanZoom();
    }

    this.filterSignals = function(searchbar, text) {
        // need to cache regexp here so filtering works across view transitions
        if (searchbar == 'srcSearch') {
            srcregexp = text ? new RegExp(text, 'i') : null;
            this.view.filterSignals('src', text.length ? text : null);
        }
        else {
            dstregexp = text ? new RegExp(text, 'i') : null;
            this.view.filterSignals('dst', text.length ? text : null);
        }
    }

    function selection_handlers() {
        $('svg').on('mousedown', function(e) {
            if (e.shiftKey == false) {
                deselectAllMaps(tables);
            }
            escaped = false;

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            // check for edge intersections around point for 'click' selection
            let updated = false;
            database.maps.each(function(map) {
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
            $('svg').on('mousemove.drawing', function(moveEvent) {
                if (stop == true || escaped == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                // check for edge intersections for 'cross' selection
                update = false;
                database.maps.each(function(map) {
                    if (!map.view || map.selected)
                        return;
                    if (edge_intersection(map.view, x1, y1, x2, y2)) {
                        updated |= select_obj(map);
                    }
                });

                e.stopPropagation();

                if (updated)
                    $('#container').trigger("updateMapProperties");

                x1 = x2;
                y1 = y2;
            });
            $('svg').one('mouseup.drawing', function(mouseUpEvent) {
                stop = true;
            });
        });
    }

    this.on_resize = function() {
        frame = fullOffset($(container)[0]);
        resize_elements(0);
    }
    
    // remove all previous DOM elements
    $(container).empty();
    frame = fullOffset($(container)[0]);
    add_canvas();
    add_display_tables();
    this.switch_view('chord');
    selection_handlers();
    add_database_callbacks();
    database.devices.each(function(dev) { update_devices(dev, 'added'); });
    database.maps.each(function(map) { update_maps(map, 'added'); });
}
