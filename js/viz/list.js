// An object for the overall display
function listView(model)
{
    var svgns = 'http://www.w3.org/2000/svg';
    var all_devices = 'All Devices';

    var tabList = null;
    var tabDevices = null;
    var selectedTab = null;
    var leftTable = null;
    var rightTable = null;
    var svgArea = null;
    var selectLists = {};
    var edges = new MapperEdgeArray();

    // The most recently selected rows, for shift-selecting
    var lastSelectedTr = {left: null, right: null};

    var srcDeviceHeaders = ["name", "outputs", "IP", "port"];
    var dstDeviceHeaders = ["name", "inputs", "IP", "port"];
    var signalHeaders = ["name", "type", "length", "units", "min", "max"];

    // "use strict";
    this.type = 'list';
    this.unmappedVisible = true; // Are unmapped devices/signals visible?
    this.focusedDevices = []; // An array containing devices seen in the display

    var leftBodyContent = [];
    var rightBodyContent = [];

    this.init = function() {
        add_tabs();
        add_title_bar();
        add_display_tables();
        add_svg_area();
        add_status_bar();
        this.add_handlers();
        select_tab(tabDevices);
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 86px)'
        });
        this.update_display();
    };

    this.cleanup = function() {
        // Remove view specific handlers
        $('*').off('.list');
        $(document).off('.list');
    };

    this.update_display = function() {
        // Removes 'invisible' classes which can muddle with display updating
        $('tr.invisible').removeClass('invisible');
        update_tabs();

        if (selectedTab == all_devices) {
            update_devices();
            update_links();
        }
        else {
            var dev = model.devices.find(selectedTab);
            if (!dev || !(dev.num_links)) {
                select_tab(tabDevices);
                return;
            }
            else {
                update_signals(selectedTab);
                update_maps();
            }
        }

        filter_view();

        $('#container').trigger("updateSaveLocation");    // trigger update save location event
    };

    this.get_save_location = function () {
        if (selectedTab == all_devices){
            // nothing to save if in the devices tab
            return '';
        }
        else {
            return '/save?dev='+encodeURIComponent(selectedTab);
        }
    };

    this.get_selected_tab = function() {
        return selectedTab;
    }

    this.get_focused_devices = function() {
        if (selectedTab == all_devices) {
            return null;
        }

        var focusedDevices = {};
        var src = model.devices.find(selectedTab);

        focusedDevices[src.name] = src;

        model.links.each(function(link) {
            if (src.name == link.src)
                focusedDevices[link.dst] = model.devices.find(link.dst);
            else if (src.name == link.dst)
                focusedDevices[link.src] = model.devices.find(link.src);
        });

        return focusedDevices;
    };

    this.on_resize = function() {
        update_edges();
        update_row_heights();
    };

    /* A function to make sure that rows fill up the available space, in
     * testing for now. */
    function update_row_heights() {
        var tableHeight = $('.tableDiv').height() - $('.tableDiv thead').height();
        var leftHeight = Math.floor(tableHeight/leftTable.nVisibleRows);
        var rightHeight = Math.floor(tableHeight/rightTable.nVisibleRows);

        $('#leftTable tbody tr').css('height', leftHeight+'px');
        $('#rightTable tbody tr').css('height', rightHeight+'px');
    }

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
            // This assumes that we will never need more than 20 columns
            // Creating and destroying th elements themselves screws up tablesorter
            for (var i=0; i<20; i++) {
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

    }

    function update_devices() {
        leftBodyContent = [];
        rightBodyContent = [];

        leftTable.set_headers(srcDeviceHeaders);
        rightTable.set_headers(dstDeviceHeaders);

        model.devices.each(function(dev) {
            if (dev.num_outputs)
                leftBodyContent.push([dev.name, dev.num_outputs,
                                      dev.host, dev.port]);
            if (dev.num_inputs)
                rightBodyContent.push([dev.name, dev.num_outputs,
                                       dev.host, dev.port]);
        });

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, srcDeviceHeaders);
        rightTable.update(rightBodyContent, dstDeviceHeaders);
    }

    function update_signals() {
        // display all signals of selected device and linked devices

        var devs = [selectedTab];
        model.links.each(function(link) {
            if (selectedTab == link.src)
                devs.push(link.dst);
            else if (selectedTab == link.dst)
                devs.push(link.src)
        });

        leftBodyContent = [];
        rightBodyContent = [];

        model.signals.each(function(sig) {
            if (devs.includes(sig.device)) {
                if (sig.direction == 'output') {
                    leftBodyContent.push([sig.device + '/' + sig.name, sig.type,
                                          sig.length, sig.unit, sig.min, sig.max]);
                }
                else {
                    rightBodyContent.push([sig.device + '/' + sig.name, sig.type,
                                           sig.length, sig.unit, sig.min, sig.max]);
                }
            }
        });

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, signalHeaders);
        rightTable.update(rightBodyContent, signalHeaders);
    }

    function update_tabs() {
        var t = tabDevices;
        var devs = [];
        model.links.each(function(link) {
            if (!(devs.includes(link.src)))
                devs.push(link.src);
            if (!(devs.includes(link.dst)))
                devs.push(link.dst);
        });
        for (var i in devs) {
            if (t.nextSibling)
                t = t.nextSibling;
            else {
                var x = document.createElement('li');
                x.onclick = function(y) {
                    return function(e) { select_tab(y);
                                         e.stopPropagation(); };
                } (x);
                t.parentNode.appendChild(x);
                t = x;
            }
            t.innerHTML = devs[i];
        }
        if (t)
            t = t.nextSibling;
        while (t) {
            var u = t.nextSibling;
            t.parentNode.removeChild(t);
            t = u;
        }
    }

    function cleanup_edge(edge) {
        if (edge.view) {
            if (edge.view.label_text)
                edge.view.label_text.remove();
            if (edge.view.label_background)
                edge.view.label_background.remove();
            if (edge.view.arrowhead_start)
                edge.view.arrowhead_start.remove();
            if (edge.view.arrowhead_end)
                edge.view.arrowhead_end.remove();
            edge.view.remove();
        }
        delete edge.view;
        edges.remove(edge);
    }

    function cleanup_edges() {
        edges.each(cleanup_edge);

    }

    function update_links() {
        // remove stale links
        old_keys = [];
        edges.each(function(edge) {
            if (!model.links.find(edge) || !update_edge_endpoints(edge)) {
                old_keys.push(edge.key);
                cleanup_edge(edge);
            }
        });

        var n_visible = edges.size();

        // add views for new links
        model.links.each(function(link) {
            if (edges.find(link))
                return;
            else if (add_edge_view(link, String(link.num_maps[0] + link.num_maps[1]),
                                   [link.num_maps[0] > 0, link.num_maps[1] > 0])) {
                edges.add(link);
                ++n_visible;
            }
        });

        $('.status.middle').text(
            n_visible + " of " + model.links.size() + " links");
    }

    function update_maps() {
        // remove stale maps
        old_keys = [];
        edges.each(function(edge) {
            if (!model.maps.find(edge) || !update_edge_endpoints(edge)) {
                old_keys.push(edge.key);
                cleanup_edge(edge);
            }
        });

        var n_visible = edges.size();

        // add views for new maps
        model.maps.each(function(map) {
            if (edges.find(map))
                return;
            else if (add_edge_view(map, null, [1, 0])) {
                edges.add(map);
                ++n_visible;
            }
        });

        var n_maps = model.maps.size();
        $('.status.middle').text(
            n_visible + " of " + n_maps + " maps");
        if (!n_maps)
            $('#saveButton').addClass('disabled');
    }

    // Filter out unmapped signals or signals that do not match the search string
    function filter_view() {
        $('.displayTable tbody tr').each(function(i, row) {
            if ((view.unmappedVisible || is_mapped(this)) && filter_match(this))
                $(this).removeClass('invisible');
            else
                $(this).addClass('invisible');
        });

        if (selectedTab == all_devices)
            update_links;
        else
            update_maps;
        $(leftTable.table).trigger('update');
        $(rightTable.table).trigger('update');

        rightTable.set_status();
        leftTable.set_status();

        update_row_heights();
        update_edges();
    }

    function filter_match(row) {
        // The text in the search box
        var filterText;
        // Test to see if the row is on the left or right table
        if ($(row).parents('.tableDiv').is('#leftTable'))
            filterText = $('#leftSearch').val();
        else if ($(row).parents('.tableDiv').is('#rightTable'))
            filterText = $('#rightSearch').val();
        else
            console.log("Error, "+row+" belongs to neither table");

        var found = false;
        // Iterate over every cell of the row
        $(row).children('td').each(function(i, cell) {
            var regExp = new RegExp(filterText, 'i');
            // Is the search string found?
            if (regExp.test($(cell).text())) {
                found = true;
            }
        });

        if (found)
            return true
        else
            return false;
    }

    /* Returns whether a row has a map. */
    function is_mapped(row) {
        // What is the name of the signal/link?
        var name = $(row).children('.name').text();
        if (selectedTab == all_devices) {
            return model.links.reduce(function(result, edge) {
                return result || name == edge.src || name == edge.dst;
            });
        }
        else {
            return model.maps.reduce(function(result, edge) {
                return result || name == edge.src || name == edge.dst;
            });
        }
    }

    function adjust_edge(edge) {
        let view = edge.view;

        let arrowhead_offset = 7;

        let S = fullOffset(view.src_tr);
        let D = fullOffset(view.dst_tr);
        let frame = fullOffset($('#svgDiv')[0]);
        let h_center = frame.width / 2;

        if (S.left < frame.left)
            var x1 = view.arrowheads[1] ? arrowhead_offset : 0;
        else
            var x1 = frame.width - (view.arrowheads[1] ? arrowhead_offset : 0);
        var y1 = S.top + S.height * view.src_offset - frame.top;

        if (D.left < frame.left)
            var x2 = view.arrowheads[0] ? arrowhead_offset : 0;
        else
            var x2 = frame.width - (view.arrowheads[0] ? arrowhead_offset : 0);
        var y2 = D.top + D.height * view.dst_offset - frame.top;

        let v_center = (y1 + y2) * 0.5;
        let h_quarter = (h_center + x1) * 0.5;
        let dasharray = edge.muted ? "--" : "";

        var path = [["M", x1, y1],
                    ["C", h_center, y1, h_center, y2, x2, y2]];

        if (view.new) {
            view.attr({"path": [["M", x1, y1],
                                ["C", x1, y1, x1, y1, x1, y1]]});
            if (view.arrowheads[0])
                view.attr({"arrow-end": "block-wide-long"});
            if (view.arrowheads[1])
                view.attr({"arrow-start": "block-wide-long"});
            view.new = false;
            view.animate({"path": [["M", x1, y1],
                                   ["C", h_quarter, y1, h_center, v_center, h_center, v_center]]}, 250, "linear",
                         function() { view.animate({"path": path}, 250, "linear")});
        }
        else
            view.animate({"path": path}, 250, "linear");
        view.attr({"stroke-dasharray": dasharray});

//        if (view.label != null) {
//            width = view.label.length * 12;
//            if (width < 20)
//                width = 20;
//            if (Math.abs(x1 - x2) <= arrowhead_offset)
//                center_x = frame.width / 2 + (x1 <= arrowhead_offset ? -35 : 35);
//            else
//                center_x = frame.width / 2;
//            center_y = (y1 + y2) / 2;
//            if (!view.label_background)
//            view.label_background = svgArea.rect(center_x - width/2,
//                                                 center_y-10, width, 20, 10);
//            // todo: move to css
//            if (view.selected)
//                view.label_background.attr({"fill": "red", "stroke": "none"});
//            else
//                view.label_background.attr({"fill": "black", "stroke": "none"});
//            if (!view.label_text) {
//                view.label_text = svgArea.text(center_x, center_y, edge.label);
//                view.label_text.attr({"font-size": 14, "fill": "white",
//                                     "text-align": "center"});
//            }
//        }

//        if (view.muted)
//            view.node.classList.add('muted');
    }

    function update_edge_endpoints(edge) {
        let found = 0
        for (var i = 1, row; row = leftTable.table.rows[i]; i++) {
            if (row.cells[0].textContent == edge.src) {
                edge.view.src_tr = row;
                ++found;
            }
            if (row.cells[0].textContent == edge.dst) {
                edge.view.dst_tr = row;
                ++found;
            }
            if (found >= 2)
                return true;
        }
        for (var i = 1, row; row = rightTable.table.rows[i]; i++) {
            if (row.cells[0].textContent == edge.src) {
                edge.view.src_tr = row;
                ++found;
            }
            if (row.cells[0].textContent == edge.dst) {
                edge.view.dst_tr = row;
                ++found;
            }
            if (found >= 2)
                return true;
        }
        return false;
    }

    function add_edge_view(edge, label, arrowheads) {
        let src_tr = null;
        let dst_tr = null;
        let found = 0;

        for (var i = 1, row; row = leftTable.table.rows[i]; i++) {
            if (row.cells[0].textContent == edge.src) {
                src_tr = row;
                ++found;
            }
            if (row.cells[0].textContent == edge.dst) {
                dst_tr = row;
                ++found;
            }
            if (found >= 2)
                break;
        }
        if (found < 2) {
            for (var i = 1, row; row = rightTable.table.rows[i]; i++) {
                if (row.cells[0].textContent == edge.src) {
                    src_tr = row;
                    ++found;
                }
                if (row.cells[0].textContent == edge.dst) {
                    dst_tr = row;
                    ++found;
                }
                if (found >= 2)
                    break;
            }
        }
        // Are these rows being displayed?
        if (found < 2 || $(src_tr).css('display') == 'none'
            || $(dst_tr).css('display') == 'none') {
            return 0;
        }

        var view = svgArea.path();

        view.src_tr = src_tr;
        view.dst_tr = dst_tr;
        view.label = label;
        view.src_offset = 0.5;
        view.dst_offset = 0.5;
        view.arrowheads = arrowheads;
        view.new = true;

        edge['view'] = view;

        return 1;
    }

    function update_edges() {
        this.touching = function(table) {
            for (var i = 1, row; row = table.table.rows[i]; i++) {
                // find edges touching this row
                let t = [];
                edges.each(function(edge) {
                    if (edge.view.src_tr == row)
                        t.push([edge.view, 0, fullOffset(edge.view.dst_tr).top]);
                    if (edge.view.dst_tr == row)
                        t.push([edge.view, 1, fullOffset(edge.view.src_tr).top]);
                });
                let len = t.length;
                if (len <= 0)
                    continue;
                // sort based on vertical row position of other endpoint
                t.sort(function(a, b) {
                    return a[2] - b[2];
                });
                for (var j = 0; j < len; j++) {
                    let offset = (j + 1) / (len + 1);
                    if (t[j][1])
                        t[j][0].dst_offset = offset;
                    else
                        t[j][0].src_offset = offset;
                }
            }
        }
        this.touching(leftTable);
        this.touching(rightTable);
        edges.each(adjust_edge);
    }

    function select_tab(tab) {
        if (selectedTab == tab.innerHTML)
            return;

        selectedTab = tab.innerHTML;
        $(".tabsel").removeClass("tabsel");
        $(tab).addClass("tabsel");

        if (tab == tabDevices) {
            $('#svgTitle').text("Links");
            leftTable.set_headers(srcDeviceHeaders);
            rightTable.set_headers(dstDeviceHeaders);
            $('#saveLoadDiv').addClass('disabled');
        }
        else {
            $('#svgTitle').text("Maps");
            leftTable.set_headers(signalHeaders);
            rightTable.set_headers(signalHeaders);
            $('#saveLoadDiv').removeClass('disabled');
        }

        $('#svgTop').text('hide unmapped');
        $('#leftSearch, #rightSearch').val('');

        $('#container').trigger("tab", selectedTab);
        cleanup_edges();
        if (selectedTab == all_devices)
            edges.keygen = model.links.keygen;
        else
            edges.keygen = model.maps.keygen;
        view.update_display();
    }

    function select_tr(tr) {
        if (!tr)
            return;

        var t = $(tr);
        var name = tr.firstChild.innerHTML.replace(/<wbr>/g,'');

        // Is the row on the left or right?
        var i = (t.parents('.displayTable')[0] == leftTable.table) ? 0 : (t.parents('.displayTable')[0] == rightTable.table) ? 1 : null;
        if (i==null)
            return;

        var l = null;
        if (selectLists[selectedTab])
            l = selectLists[selectedTab][i];
        else
            selectLists[selectedTab] = [null, null];
        if (!l)
            l = new Assoc();

        if (t.hasClass("trsel")) {
            t.removeClass("trsel");
            l.remove(name);
        } else {
            t.addClass("trsel");
            l.add(name, tr.parentNode);
        }

        if (i == 0) // Left table
            lastSelectedTr.left = tr;
        else if (i == 1)
            lastSelectedTr.right = tr;

        selectLists[selectedTab][i] = l;
        $('#container').trigger("updateMapProperties");
    }

    // For selecting multiple rows with the 'shift' key
    function full_select_tr(tr) {
        var targetTable = $(tr).parents('.tableDiv').attr('id') == 'leftTable' ? '#leftTable' : '#rightTable';
        var trStart = targetTable == '#leftTable' ? lastSelectedTr.left : lastSelectedTr.right;
        if (!trStart) {
            return;
        }

        var index1 = $(tr).index();
        var index2 = $(trStart).index();

        var startIndex = Math.min(index1, index2);
        var endIndex = Math.max(index1, index2);

        $(''+targetTable+' tbody tr').each(function(i, e) {
            if (i > startIndex && i < endIndex
                && !$(e).hasClass('invisible') && !$(e).hasClass('trsel')){
                select_tr(e);
                $('#container').trigger("updateMapProperties");
            }
        });
    }

    function deselect_all() {
        $('tr.trsel', leftTable.table).each(function(i,e) {
            selectLists[selectedTab][0].remove(e.firstChild.innerHTML.replace(/<wbr>/g, ''));
            $(this).removeClass('trsel');
        });
        $('tr.trsel', rightTable.table).each(function(i,e) {
            selectLists[selectedTab][1].remove(e.firstChild.innerHTML.replace(/<wbr>/g, ''));
            $(this).removeClass('trsel');
        });
        lastSelectedTr.left = null;
        lastSelectedTr.right = null;

        edges.each(function(edge) {
            if (edge.view.selected) {
                edge.view.animate({"stroke": "black"}, 50);
                edge.view.selected = false;
            }
        });
        $('#container').trigger("updateMapProperties");
    }

    function select_all() {
        edges.each(function(edge) {
            if (!edge.view.selected) {
                edge.view.animate({"stroke": "red"}, 50);
                edge.view.selected = true;
            }
        });
    }

    function on_table_scroll() {
        update_edges();
    }

    function on_link(e, start, end) {
        if (start && end)
            $('#container').trigger("link", [start.cells[0].textContent,
                                             end.cells[0].textContent]);
        e.stopPropagation();
    }

    function on_unlink(e) {
        edges.each(function(edge) {
            if (edge.view.selected)
                $('#container').trigger("unlink", [edge.src, edge.dst]);
        });
        e.stopPropagation();
    }

    function on_map(e, start, end, args) {
        if (model.mKey) {
            args['muted'] = true;
        }
        $('#container').trigger("map", [start.cells[0].textContent,
                                        end.cells[0].textContent, args]);
        e.stopPropagation();
    }

    function on_unmap(e) {
        edges.each(function(edge) {
            if (edge.view.selected)
                $('#container').trigger("unmap", [edge.src, edge.dst]);
        });
        e.stopPropagation();
    }

    function add_tabs() {
        $('#container').append(
            "<ul class='topTabs'>"+
                "<li id='allDevices'>"+all_devices+"</li>"+
            "</ul>");
        tabList = $('.topTabs')[0];
        tabDevices = $('#allDevices')[0];

        selectedTab = all_devices;
    }

    function add_title_bar() {
        $('#container').append(
            "<div id='titleSearchDiv'>"+
                "<h2 id='leftTitle' class='searchBar'>Sources</h2></li>"+
                "<input type='text' id='leftSearch' class='searchBar'></input></li>"+
                "<h2 id='svgTitle' class='searchBar'>Links</h2></li>"+
                "<h2 id='rightTitle' class='searchBar'>Destinations</h2></li>"+
                "<input type='text' id='rightSearch' class='searchBar'></input></li>"+
            "</div>");
        var $titleSearchDiv = $('<div id="titleSearchDiv"></div>');
    }

    function add_display_tables() {
        leftTable = new listTable('leftTable');
        rightTable = new listTable('rightTable');

        // Put the tables in the DOM
        leftTable.create_within($('#container')[0]);
        rightTable.create_within($('#container')[0]);

        leftTable.set_headers(['device', 'outputs', 'IP', 'port']);
        rightTable.set_headers(['device', 'input', 'IP', 'port']);

        $(leftTable.table).tablesorter({widgets: ['zebra']});
        $(rightTable.table).tablesorter({widgets: ['zebra']});
    }


    function add_svg_area() {
        $('#container').append(
            "<div id='svgDiv' class='links'>"+
                "<div id='svgTop'>hide unmapped</div>"+
            "</div>");

        svgArea = Raphael($('#svgDiv')[0], '100%', '100%');

    }

    function add_status_bar() {
        $('#container').append(
            "<table id='statusBar'>"+
                "<tr>"+
                    "<td class='status left'></td>"+
                    "<td class='status middle'></td>"+
                    "<td class='status right'></td>"+
                "</tr>"+
            "</table>");

        leftTable.footer = $("#statusBar .left")[0];
        rightTable.footer = $("#statusBar .right")[0];
    }

    function drawing_curve(sourceRow) {
        var self = this;
        this.sourceRow = sourceRow;
        this.targetRow;
        this.muted = false;
        var allow_self_link = selectedTab == all_devices;

        this.canvasWidth = $('#svgDiv').width();

        this.clamptorow = function(row, is_dst) {
            var svgPos = fullOffset($('#svgDiv')[0]);
            var rowPos = fullOffset(row);
            var divisor = is_dst ? 1.8 : 2.2;
            var y = rowPos.top + rowPos.height/divisor - svgPos.top;
            return y;
        };

        this.findrow = function (y) {
            // The upper position of the canvas (to find the absolute position)
            var svgTop = $('#svgDiv').offset().top;

            // Left edge of the target table
            var ttleft = $(this.targetTable.tbody).offset().left + 5;

            // Closest table element (probably a <td> cell)
            var td = document.elementFromPoint(ttleft, svgTop + y);
            var row = $(td).parents('tr')[0];
            var incompatible = $(row).hasClass('incompatible');
            return incompatible ? null : row;
        };

        // Our bezier curve points
        this.path = [["M"], ["C"]];

        // Are we starting from for the left or right table?
        this.sourceTable;
        this.targetTable;
        if ($(this.sourceRow).parents('.tableDiv').attr('id') == "leftTable") {
            this.sourceTable = leftTable;
            this.path[0][1] = 0; // Start the curve at left
        }
        else {
            this.sourceTable = rightTable;
            this.path[0][1] = this.canvasWidth; // Start the curve at right
        }

        // And in the middle of the starting row
        this.path[0][2] = this.clamptorow(this.sourceRow, 0);

        // The actual line
        this.line = svgArea.path();
        this.line.attr({"stroke-width": "2px"});
        this.edge = svgArea.path();
        this.edge.attr({"stroke-width": "2px", "fill": "black"});
        this.edge.attr({"path": "M0 0l10 -6l0 12z"});

        this.update = function(moveEvent) {
            moveEvent.offsetX = moveEvent.pageX - $('#svgDiv').offset().left;
            moveEvent.offsetY = moveEvent.pageY - $('#svgDiv').offset().top;

            var target = moveEvent.currentTarget;
            var start = [this.path[0][1], this.path[0][2]];
            var end = [this.path[1][5], this.path[1][6]];
            var c1 = null;
            if (target.tagName == "svg") {
                end = [moveEvent.offsetX, moveEvent.offsetY];
                var absdiff = Math.abs(end[0] - start[0]);

                // get targetTable
                var newTargetTable;
                if (absdiff < this.canvasWidth/2)
                    newTargetTable = this.sourceTable;
                else if (this.sourceTable == leftTable)
                    newTargetTable = rightTable;
                else
                    newTargetTable = leftTable;
                if (this.targetTable != newTargetTable) {
                    this.targetTable = newTargetTable;
                    // Fade out incompatible signals
                    if (selectedTab != all_devices)
                        fade_incompatible_signals(this.sourceRow);
                }

                // Within clamping range?
                if (absdiff < 50) {
                    // we can clamp to same side
                    var startRow = this.findrow(start[1]);
                    var clampRow = this.findrow(end[1]);
                    if (clampRow && (allow_self_link || clampRow != startRow)) {
                        if (this.sourceTable == this.targetTable)
                            end[0] = start[0];
                        else
                            end[0] = this.canvasWidth - start[0] - 2;
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow, 1);
                        this.checkTarget(clampRow);
                    }
                    else
                        this.checkTarget(null);
                }
                else if (this.canvasWidth - absdiff < 50) {
                    var clampRow = this.findrow(end[1]);
                    if (clampRow) {
                        end[0] = this.canvasWidth - start[0] - 2;
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow, 1);
                        this.checkTarget(clampRow);
                    }
                    else
                        this.checkTarget(null);
                }
                else
                    this.checkTarget(null);
            }
            // We're over a table row of the target table
            if ($(target).parents('tbody')[0] == this.targetTable.tbody) {
                var rowHeight = $(target).height();
                this.checkTarget(target);
                if (this.sourceTable == this.targetTable) {
                    end[0] = start[0];
                    if (!($(target).hasClass('incompatible')))
                        end[1] = this.clamptorow(target, 1);
                    else
                        end[1] = moveEvent.offsetY;
                }
                else {
                    end[0] = this.canvasWidth - start[0] - 2;
                    if (!($(target).hasClass('incompatible')))
                        end[1] = this.clamptorow(target, 1);
                    else
                        end[1] = moveEvent.offsetY;
                }
            }
            this.path = get_bezier_path(start, end, c1, this.canvasWidth);
            this.line.attr({"path": this.path});
            this.edge.transform("");
            var angle = (end[0] > this.canvasWidth/2) ? 180 : 0
            this.edge.transform([["r", angle, end[0], end[1]],
                                  ["t", end[0], end[1]]]);
        };

        this.mouseup = function(mouseUpEvent) {
            if (selectedTab == all_devices)
                on_link(mouseUpEvent, this.sourceRow, this.targetRow);
            else if (this.targetRow) {
                on_map(mouseUpEvent, this.sourceRow,
                       this.targetRow, {'muted': this.muted});
            }
            $("*").off('.drawing').removeClass('incompatible');
            $(document).off('.drawing');
            self.line.remove();
            self.edge.remove();
        };

        // Check if we have a new target row, select it if necessary
        this.checkTarget = function(mousedOverRow) {
            if (this.targetRow == mousedOverRow
                || (this.sourceRow == this.targetRow && !allow_self_link))
                return;
            if ($(mousedOverRow).hasClass('incompatible')) {
                this.targetRow = null;
                return;
            }
            if (this.targetRow != null) {
                // deselect previous
                select_tr(this.targetRow);
            }
            this.targetRow = mousedOverRow;
            select_tr(this.targetRow);
        };
    }

    // Finds a bezier curve between two points
    function get_bezier_path(start, end, controlEnd, width) {
        // 'Move to': (x0, y0), 'Control': (C1, C2, end)
        var path = [["M", start[0], start[1]], ["C"]];

        // x-coordinate of both control points
        path[1][1] = path[1][3] = width / 2;
        // y-coordinate of first control point
        if (start[0] == end[0] && start[1] == end[1]) {
            path[1][2] = start[1] + 40;
            if (controlEnd)
                path[1][4] = controlEnd - 40;
            else
                path[1][4] = end[1] - 40;
        }
        else {
            path[1][2] = start[1];
            // y-coordinate of second control point
            if (controlEnd)
                path[1][4] = controlEnd;
            else
                path[1][4] = end[1];
        }

        // Finally, the end points
        path[1][5] = end[0];
        path[1][6] = end[1];

        return path;
    }

    function fade_incompatible_signals(row) {
        $(row).addClass('incompatible');
        edges.each(function(edge) {
            if (edge.view.src_tr == row)
                $(edge.view.dst_tr).addClass('incompatible');
            else if (edge.view.dst_tr == row)
                $(edge.view.src_tr).addClass('incompatible');
        });
    }

    function drawing_handlers() {
        // Wait for a mousedown on either table
        // Handler is attached to table, but 'this' is the table row
        $('.displayTable').on('mousedown', 'tr', function(tableClick) {

            var sourceRow = this;

            // Cursor enters the canvas
            $('#svgDiv').one('mouseenter.drawing', function() {

                var curve = new drawing_curve(sourceRow);

                // Make sure only the proper row is selected
                deselect_all();
                select_tr(curve.sourceRow);
                $('#container').trigger("updateMapProperties");

                // Moving about the canvas
                $('svg, .displayTable tbody tr').on('mousemove.drawing',
                                                    function(moveEvent) {
                    curve.update(moveEvent);
                });

                $(document).one('mouseup.drawing', function(mouseUpEvent) {
                    curve.mouseup(mouseUpEvent);
                });

                $(document).on('keydown.drawing', function(keyPressEvent) {
                    if (selectedTab != all_devices && keyPressEvent.which == 77) {
                        // Change if the user is drawing a muted map
                        if (curve.muted == true) {
                            curve.muted = false;
                            curve.line.node.classList.remove('muted');
                        }
                        else {
                            curve.muted = true;
                            curve.line.node.classList.add('muted');
                        }
                    }
                });

            });

            $(document).one('mouseup.drawing', function(mouseUpEvent) {
                $("*").off('.drawing').removeClass('incompatible');
                $(document).off('.drawing');
            });
        });
    }

    // calculate intersections
    // adapted from https://bl.ocks.org/bricof/f1f5b4d4bc02cad4dea454a3c5ff8ad7
    function is_between(a, b1, b2, fudge) {
        if ((a + fudge >= b1) && (a - fudge <= b2)) {
            return true;
        }
        if ((a + fudge >= b2) && (a - fudge <= b1)) {
            return true;
        }
        return false;
    }

    function line_line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        let m1 = (x1 == x2) ? 1000000 : (y1 - y2) / (x1 - x2);
        let m2 = (x3 == x4) ? 1000000 : (y3 - y4) / (x3 - x4);
        if (m1 == m2) {
            // lines are parallel - todo check if same b, overlap
            return false;
        }
        let b1 = y1 - x1 * m1;
        let b2 = y3 - x3 * m2;
        let isect_x = (b2 - b1) / (m1 - m2);
        let isect_y = isect_x * m1 + b1;
        return (   is_between(isect_x, x1, x2, 0.1)
                && is_between(isect_x, x3, x4, 0.1)
                && is_between(isect_y, y1, y2, 0.1)
                && is_between(isect_y, y3, y4, 0.1));
    }

    function edge_intersection_select(x1, y1, x2, y2) {
        let updated = false;
        edges.each(function(edge) {
            let len = edge.view.getTotalLength();
            let isect = false;
            for (var j = 0; j < 10; j++) {
                let p1 = edge.view.getPointAtLength(len * j * 0.1);
                let p2 = edge.view.getPointAtLength(len * (j + 1) * 0.1);

                if (line_line_intersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
                   isect = true;
                   break;
                }
            }
            if (!isect)
                return;
            if (!edge.view.selected) {
                edge.view.selected = true;
                ++updated;
            }
            if (updated) {
                edge.view.animate({"stroke": "red"}, 50);
                $('#container').trigger("updateMapProperties");
            }
        });
    }

    function selection_handlers() {
        $('.links').on('mousedown', function(e) {
            if (e.shiftKey == false) {
                deselect_all();
            }

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            // try intersection with 'X'around cursor for select on 'click'
            edge_intersection_select(x1-3, y1-3, x1+3, y1+3);
            edge_intersection_select(x1-3, y1+3, x1+3, y1-3);

            let stop = false;
            // Moving about the canvas
            $('.links').on('mousemove.drawing', function(moveEvent) {
                if (stop == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                edge_intersection_select(x1, y1, x2, y2);

                e.stopPropagation();

                x1 = x2;
                y1 = y2;
            });
            $('.links').one('mouseup.drawing', function(mouseUpEvent) {
                stop = true;
            });
        });
    }

    this.add_handlers = function() {
//        $('#container').on('click.list', function() {
//            deselect_all();
//        });

        $('.displayTable tbody').on({
            mousedown: function(e) {
                if (e.shiftKey == true)    // For selecting multiple rows at once
                    full_select_tr(this);
                else
                    deselect_all();
                select_tr(this);
            },
            click: function(e) { e.stopPropagation(); }
        }, 'tr');

        // For redrawing edges upon table sort
        $('.displayTable thead').on('click', 'th', function(e) {
            e.stopPropagation();
            $(this).parents(".displayTable").one('sortEnd', function() {
                update_edges();
            });
        });

        // Various keyhandlers
        $('body').on('keydown.list', function(e) {
            if (e.which == 8 || e.which == 46) { // unmap on 'delete'
                // Prevent the browser from going back a page
                // but NOT if you're focus is an input and deleting text
                if (!$(':focus').is('input')) {
                    e.preventDefault();
                }
                if (selectedTab == all_devices)
                    on_unlink(e);
                else
                    on_unmap(e);
                deselect_all();
            }
            else if (e.which == 65 && e.metaKey == true) { // Select all 'cmd+a'
                e.preventDefault();
                select_all();
            }
            else if (e.which == 9 && e.altKey == true) {
                // Tabbing like in google chrome 'alt-tab'
                e.preventDefault();
                var n_tabs = $('.topTabs li').length;
                var currentTabIndex = $('li.tabsel').index() + 1;
                var nextTabIndex;
                if (e.shiftKey == false) { // Tabbing forwards
                    if (currentTabIndex < n_tabs)
                        nextTabIndex = currentTabIndex + 1;
                    else // If we're at the last tab, select the first one
                        nextTabIndex = 1;
                }
                else {  // Tabbing backwards
                    if (currentTabIndex == 1) // At the first tab, go to the last
                        nextTabIndex = n_tabs;
                    else
                        nextTabIndex = currentTabIndex - 1;
                }
                select_tab($(tabList).children(':nth-child('+nextTabIndex+')')[0]);
            }
            else if ((e.which == 37 || e.which == 39)
                     && e.altKey == true && e.metaKey == true) {
                // Tabbing like in google chrome 'cmd-opt-left'
                e.preventDefault();
                var n_tabs = $('.topTabs li').length;
                var currentTabIndex = $('li.tabsel').index() + 1;
                var nextTabIndex;
                if (e.which == 39) { // Tabbing forwards
                    if (currentTabIndex < n_tabs)
                        nextTabIndex = currentTabIndex + 1;
                    else // If we're at the last tab, select the first one
                        nextTabIndex = 1;
                }
                else if (e.which == 37) {  // Tabbing backwards
                    if (currentTabIndex == 1) // At the first tab, go to the last
                        nextTabIndex = n_tabs;
                    else
                        nextTabIndex = currentTabIndex - 1;
                }
                select_tab($(tabList).children(':nth-child('+nextTabIndex+')')[0]);
            }
        });

        // The all devices tab
        $('#allDevices').on('click', function(e) {
            select_tab(tabDevices);
            e.stopPropagation();
        });

        // Search function boxes
        $('#leftSearch, #rightSearch').on('keyup', function(e) {
            e.stopPropagation();
            filter_view();
        });

        $('.tableDiv').on('scroll', function(e) {
            update_edges();
        });

        $('#svgTop').on('click', function(e) {
            e.stopPropagation();
            if (view.unmappedVisible == true) {
                view.unmappedVisible = false;
                $('#svgTop').text('show unmapped');
            }
            else {
                view.unmappedVisible = true;
                $('#svgTop').text('hide unmapped');
            }
            filter_view();
        });

        drawing_handlers();
        selection_handlers();
    }
}
