//++++++++++++++++++++++++++++++++++++++ //
//              View Class               //
//++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
    var _self = this;
    this.svgArea = null;
    var frame = null;
    var width = null;
    var height = null;
    var origin = null;
    var view_counter = 0;
    var device_shape = null;
    var leftTableWidth = 40;
    var rightTableWidth = 40;

    function circle_path(x, y, radius) {
        radius = 10;
        return [['M', x + radius * 0.65, y - radius * 0.65],
                ['a', radius, radius, 0, 1, 0, 0.001, 0.001],
                ['z']];
    }

    function rect_path(x, y, w, h) {
        return [['M', x, y],
                ['l', w, 0],
                ['l', 0, h],
                ['l', -w, 0],
                ['z']];
    }

    function switch_view(view) {
        // stop current animations
        $('#leftTable').stop(true, false);
        $('#rightTable').stop(true, false);
        $('#svgDiv').stop(true, false);

        // cache current values for table widths
        let leftWas = leftTableWidth;
        let rightWas = rightTableWidth;
        let leftTarget, rightTarget;

        switch (view) {
            case 'list':
                leftTarget = 40;
                rightTarget = 40;
                break;
            case 'canvas':
                leftTarget = 25;
                rightTarget = 0;
                break;
            default:
                leftTarget = 0;
                rightTarget = 0;
                break;
        }

        $('#leftTable').animate({'width': leftTarget + '%'},
                                {duration: 1500, step: function(now, fx) {
                                    leftTableWidth = now;
                                    let progress = (now - leftWas) / (leftTarget - leftWas);
                                    rightTableWidth = (rightTarget - rightWas) * progress + rightWas;
                                    $('#rightTable').css({
                                        'width': rightTableWidth + '%',
                                        'left': 100 - rightTableWidth + '%'});
                                    $('#svgDiv').css({
                                        'width': 100 - leftTableWidth - rightTableWidth + '%',
                                        'left': leftTableWidth + '%'});
                                }});

        switch (view) {
            case 'hive':
                redraw = function() {
                    let dev_index = 0;
                    let dev_num = model.devices.size();
                    if (dev_num && dev_num > 1)
                        dev_num -= 1;
                    else
                        dev_num = 1;
                    let angleInc = (Math.PI * 0.5) / dev_num;
                    model.devices.each(function(dev) {
                        if (!dev.view)
                            return;
                        angle = dev_index * -angleInc;
                        let path = [['M', origin.x, origin.y],
                                    ['l', width * Math.cos(angle), height * Math.sin(angle)]];
                        dev.view.animate({'path': path,
                                          'stroke-opacity': 1}, 500, 'linear');
                        dev.view.angle = angle;
                        dev_index += 1;
                        let sig_index = 1;
                        let sig_num = dev.signals.size();
                        let inc = sig_num ? 1 / sig_num : 1;
                        dev.signals.each(function(sig) {
                            if (!sig.view)
                                return;
                            let x = origin.x + width * inc * sig_index * Math.cos(angle);
                            let y = origin.y + height * inc * sig_index * Math.sin(angle);
                            let path = circle_path(x, y, 3);
                            sig.view.animate({'path': path}, 500, 'linear');
                            sig.view.position = new_pos(x, y);
                            sig_index += 1;
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let path = [['M', src.x, src.y],
                                    ['S', frame.cx, frame.cy, dst.x, dst.y]];
                        map.view.attr({'arrow-end': 'block-wide-long'});
                        map.view.animate({'path': path, 'fill-opacity': '0'}, 500, 'linear');
                    });
                }
                break;
            case 'grid':
                redraw = function() {
                    let num_sigs = 0;
                    model.devices.each(function(dev) {
                        num_sigs += dev.signals.size();
                    });
                    let sig_index = 1;
                    let inc = num_sigs ? 1 / num_sigs : 1;
                    model.devices.each(function(dev) {
                        let path = [['M', origin.x + width * inc * sig_index, origin.y],
                                    ['l', width * inc * (dev.signals.size()-1), 0],
                                    ['M', origin.x, origin.y - height * inc * sig_index],
                                    ['l', 0, -height * inc * (dev.signals.size()-1)]];
                        dev.view.animate({'path': path});
                        dev.signals.each(function(sig) {
                            let mult = inc * sig_index;
                            let path = circle_path(origin.x + width * mult, origin.y, 10);
                            path.push(circle_path(origin.x, origin.y - height * mult, 10));
                            path.push([['M', origin.x + width * mult, origin.y],
                                       ['l', 0, -height]]);
                            path.push([['M', origin.x, origin.y - height * mult],
                                       ['l', width, 0]]);
                            sig.view.animate({'path': path,
                                              'stroke-opacity': 1});
                            // todo: only store mult to make resize draws more efficient?
                            sig.view.position = new_pos(origin.x + width * mult, origin.y - height * mult);
                            sig_index += 1;
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let path = circle_path(dst.x, src.y, 10);
                        map.view.attr({'arrow-end': 'none'});
                        map.view.animate({'path': path, 'fill': 'black', 'fill-opacity': '1'}, 500, 'linear');
                    });
                }
                break;
            case 'list':
                /* to do
                 * basic list view (outputs on left, inputs on right)
                 * bezier edges between them
                 * scrolling
                 * sorting (move to top bar)
                 * searching (move to top bar)
                 */
                break;
        }
        redraw();
    }

    switch_view('hive');

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(obj_type, event, key) {
            switch (obj_type) {
                case 'device':
                    update_devices(obj, event);
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

        // An object for the left and right tables, listing devices and signals
    function listTable(id) {
        this.id = id; // Something like "leftTable"
        this.parent; // The node containing the table
        this.div; // The div node (and status)
        this.table; // The table node itself
        this.headerRow; // The top row node of the table within <thead>
        this.tbody; // The <tbody> node
        this.footer; // The status bar at the bottom

        this.nRows; // Number of rows (e.g. devices or signals) present
        this.nVisibleRows; // Number of rows actually visible to the user
        this.nCols; // Number of columns in table

            // Should be passed a the node for the parent
        this.create_within = function(parent) {
            this.parent = parent;
                // Create the div containing the table
            $(this.parent).append("<div class='tableDiv' id='"+id+"'></div>");
            this.div = $(this.parent).children("#"+this.id);

                // Create the skeleton for the table within the div
            $(this.div).append(
                               "<table class='displayTable'>"+
                               "<thead><tr></tr></thead>"+
                               "<tbody></tbody>"+
                               "</table>");
            this.table = $(this.div).children('.displayTable')[0];
            this.headerRow = $("#"+this.id+" .displayTable thead tr")[0];
            this.tbody = $("#"+this.id+" .displayTable tbody")[0];

                // Create the header elements
                // This assumes that we do not need more than 5 columns
                // Creating and destroying th elements themselves screws up tablesorter
            for (var i = 0; i < 6; i++) {
                $(this.headerRow).append("<th class='invisible'></th>");
            }
        };

            // e.g. headerStrings = ["Name", "Units", "Min", "Max"]
        this.set_headers = function(headerStrings) {
            this.nCols = headerStrings.length;

            $(this.headerRow).children('th').each(function(index) {
                                                  if (index < headerStrings.length)
                                                  $(this).text(headerStrings[index]).removeClass("invisible");
                                                  else
                                                  $(this).text("").addClass("invisible");
                                                  });
        };

            // For when something changes on the network
        this.update = function(tableData, headerStrings) {
            $(this.tbody).empty();
            for (var row in tableData) {
                    // If there is only one row, make it of even class for styling
                var newRow = "<tr>";
                for (var col in tableData[row]) {
                    if (tableData[row][col]==undefined)
                        tableData[row][col] = '';
                    newRow += "<td class="+headerStrings[col]+">"+tableData[row][col]+"</td>";
                }
                $(this.tbody).append(newRow+"</tr>");
            }
            this.nRows = tableData.length;
            if (tableData[0])
                this.nCols = tableData[0].length;
            this.set_status();
            this.update_row_heights();
            $(this.table).trigger('update');
        };

        this.set_status = function() {
            var name; // Devices or signals
            if (selectedTab == all_devices) {
                name = "devices";
            }
            else name = "signals";
            this.nVisibleRows = $(this.tbody).children('tr').length - $(this.tbody).children('tr.invisible').length;
            $(this.footer).text(this.nVisibleRows+" of "+this.nRows+" "+name);

                // For styling purposes when there is only a single row
            if (this.nVisibleRows == 1)
                $(this.tbody).children('tr').addClass('even');
        };
        
        /* A function to make sure that rows fill up the available space, in
         * testing for now. */
        this.update_row_heights = function() {
            let height = Math.floor(tableHeight/this.nVisibleRows);
            $("#"+this.id+' tbody tr').css('height', height+'px');
        };
    }

    function add_display_tables() {
        leftTable = new listTable('leftTable');
        rightTable = new listTable('rightTable');

            // Put the tables in the DOM
        leftTable.create_within($('#container')[0]);
        rightTable.create_within($('#container')[0]);

        leftTable.set_headers(['device', 'outputs', 'host', 'port']);
        rightTable.set_headers(['device', 'input', 'host', 'port']);

        $(leftTable.table).tablesorter({widgets: ['zebra']});
        $(rightTable.table).tablesorter({widgets: ['zebra']});

        tableHeight = ($('.tableDiv').height() - $('.tableDiv thead').height()
                       - $('#statusBar').height());
    }

    function add_svg_area() {
        $('#container').append(
            "<div id='svgDiv' class='links'>"+
                "<div id='svgTop'>hide unmapped</div>"+
            "</div>");

        svgArea = Raphael($('#svgDiv')[0], '100%', '100%');
        frame = fullOffset($('#svgDiv')[0]);
        frame.cx = frame.width * 0.5;
        frame.cy = frame.height * 0.5;
        width = frame.width - 200;
        height = frame.height - 200;
        origin = {"x": 100, "y": frame.height - 50};
    };

    this.init = function() {
        // remove all previous DOM elements
        $(container).empty();
        add_display_tables();
        add_svg_area();
//        this.add_handlers();
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 86px)'
        });
        add_model_callbacks();

        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function update_devices(dev, event) {
        if (event == 'removing' && dev.view) {
            if (!dev.view)
                return;
            dev.signals.each(function(sig) { sig.view.remove(); });
            dev.view.remove();
            return;
        }
        else if (event == 'added' && !dev.view) {
            let color = Raphael.getColor();
            dev.view = svgArea.path().attr({
                "path": [['M', origin.x, origin.y], ['L',10, 0]],
                "stroke": color});
            dev.view.color = color;
            dev.view.angle = 0;
            dev.view.signals = {};
            dev.signals.each(function(sig) {
                update_signals(sig, 'added', false);
            });
            redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    function new_pos(x, y) {
        let frame = fullOffset($('#svgDiv')[0]);
        return {'x': x ? x : Math.random() * frame.width + frame.left,
            'y': y ? y : Math.random() * frame.height + frame.top};
    }

    function update_signals(sig, event, repaint) {
        if (event == 'removing' && sig.view)
            sig.view.remove();
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let path = circle_path(origin.x, origin.y, 3);
            sig.view = svgArea.path()
                            .attr({ 'path': path,
                                    'fill': dev.view.color,
                                    'stroke': dev.view.color });
            sig.view.position = new_pos(origin.x, origin.y);
            if (repaint)
                redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    function update_maps(map, event) {
        console.log('map event', event, map);
        if (event == 'removing' && map.view) {
            map.view.remove();
            return;
        }
        else if (event == 'added' && !map.view) {
            let src = map.src.view.position;
            let dst = map.dst.view.position;
            let path = [['M', src.x, src.y],
                        ['L', dst.x, dst.y]];
            map.view = svgArea.path().attr({'path': path,
                                            'arrow-end': 'block-wide-long'});
            redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    $('body').on('keydown.list', function(e) {
        if (e.which == 32) {
            view_counter += 1;
            if (view_counter > 3)
                 view_counter = 0;
            view_names = ['list', 'grid', 'canvas', 'hive'];
            switch_view(view_names[view_counter]);
            redraw();
        }
    });
}

HivePlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
