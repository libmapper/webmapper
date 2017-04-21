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
    var devActions = null;
    var sigActions = null;
    var arrows = [];
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

    this.init = function()
    {
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
            'height': 'calc(100% - 85px)'
        });
        this.update_display();
    };

    this.cleanup = function()
    {
        // Remove view specific handlers
        $('*').off('.list');
        $(document).off('.list');
    };

    this.update_display = function()
    {
        // Removes 'invisible' classes which can muddle with display updating
        $('tr.invisible').removeClass('invisible');
        update_arrows();
        update_tabs();

        if (selectedTab == all_devices) {
            update_devices();
        }
        else if (!model.isLinked(selectedTab, null)) {
            select_tab(tabDevices);
            return;
        }
        else {
            update_signals(selectedTab);
        }

        filter_view();
        // update_row_heights();

        $('#container').trigger("updateSaveLocation");    // trigger update save location event
    };

    this.get_save_location = function ()
    {
        if (selectedTab == all_devices){
            // nothing to save if in the devices tab
            return '';
        }
        else {
            return '/save?dev='+encodeURIComponent(selectedTab);
        }
    };

    this.get_selected_tab = function()
    {
        return selectedTab;
    }

    this.get_focused_devices = function()
    {
        if (selectedTab == all_devices) {
            return null;
        }

        var focusedDevices = new Assoc();
        var sourceDevice = model.devices.get(selectedTab);

        focusedDevices.add(sourceDevice.name, sourceDevice);

        var links = model.links.keys();
        for (var i in links) {
            var devs = links[i].split('>');
            if (devs[0] == sourceDevice.name) {
                var dstD = model.devices.get(devs[1]);
                focusedDevices.add(dstD.name, dstD);
            }
            else if (devs[1] == sourceDevice.name) {
                var dstD = model.devices.get(devs[0]);
                focusedDevices.add(dstD.name, dstD);
            }
        }

        return focusedDevices;
    };

    this.on_resize = function()
    {
        update_arrows();
        update_row_heights();
    };

    // A function to make sure that rows fill up the available space, in testing for now
    function update_row_heights()
    {
        var tableHeight = $('.tableDiv').height() - $('.tableDiv thead').height();
        var leftHeight = Math.floor(tableHeight/leftTable.nVisibleRows);
        var rightHeight = Math.floor(tableHeight/rightTable.nVisibleRows);

        $('#leftTable tbody tr').css('height', leftHeight+'px');
        $('#rightTable tbody tr').css('height', rightHeight+'px');
    }

    // An object for the left and right tables, listing devices and signals
    function listTable(id)
    {
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
        this.create_within = function(parent)
        {
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
        this.set_headers = function(headerStrings)
        {
            this.nCols = headerStrings.length;

            $(this.headerRow).children('th').each(function(index) {
                if (index < headerStrings.length)
                    $(this).text(headerStrings[index]).removeClass("invisible");
                else
                    $(this).text("").addClass("invisible");
            });
        };

        // For when something changes on the network
        this.update = function(tableData, headerStrings)
        {
            $(this.tbody).empty();
            for (var row in tableData)
            {
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

        this.set_status = function()
        {
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

    function update_devices()
    {
        var keys = model.devices.keys();

        leftBodyContent = [];
        rightBodyContent = [];

        leftTable.set_headers(srcDeviceHeaders);
        rightTable.set_headers(dstDeviceHeaders);

        for (var d in keys) {
            var k = keys[d];
            var dev = model.devices.get(k);

            if (dev.num_outputs) {
                leftBodyContent.push([dev.name, dev.num_outputs,
                                      dev.host, dev.port]);}
            if (dev.num_inputs) {
                rightBodyContent.push([dev.name, dev.num_inputs,
                                       dev.host, dev.port]);}

        }

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, srcDeviceHeaders);
        rightTable.update(rightBodyContent, dstDeviceHeaders);
    }

    function update_signals() {
        // display all signals of selected device and linked devices

        var srcDev = selectedTab;
        var dstDev = [];
        var linkedDevs = model.getLinked(srcDev);
        for (var i in linkedDevs) {
            var d = model.devices.get(linkedDevs[i]);
            if (d && d.num_inputs > 0)
                dstDev.push(d.name);
        }
        var keys = model.signals.keys();

        leftBodyContent = [];
        rightBodyContent = [];

        for (var s in keys) {
            var k = keys[s];
            var sig = model.signals.get(k);
            var lnk1 = model.links.get(selectedTab+'>'+sig.device);
            var lnk2 = model.links.get(sig.device+'>'+selectedTab);
            if (sig.device != selectedTab && lnk1 == null && lnk2 == null)
                continue;

            // So that all browsers break the line properly
            var sigName = sig.name.replace(RegExp('/','g'), '<wbr>/');
            if (sig.direction == 2) {
                leftBodyContent.push([sig.device+'/'+sigName, sig.type,
                                      sig.length, sig.unit, sig.min, sig.max]);
            }
            else {
                rightBodyContent.push([sig.device+'/'+sigName, sig.type,
                                       sig.length, sig.unit, sig.min, sig.max]);
            }
        }

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, signalHeaders);
        rightTable.update(rightBodyContent, signalHeaders);
    }

    function update_tabs()
    {
        var t = tabDevices;
        var keys = model.devices.keys();
        var srcs = {};
        for (var k in keys) {
            var d = model.devices.get(keys[k])
            if (model.isLinked(d.name))
                srcs[d.name] = null;
        }
        for (var s in srcs) {
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
            t.innerHTML = s;
        }
        if (t) t = t.nextSibling;
        while (t) {
            var u = t.nextSibling;
            t.parentNode.removeChild(t);
            t = u;
        }
    }

    function cleanup_arrows()
    {
        for (var a in arrows) {
            arrows[a].border.remove();
            if (arrows[a].label)
                arrows[a].label.remove();
            if (arrows[a].label_background)
                arrows[a].label_background.remove();
            arrows[a].remove();
        }
        arrows = [];
    }

    function update_links()
    {
        cleanup_arrows();

        // How many are actually being displayed?
        var n_visibleLinks = 0;

        var keys = model.links.keys();
        for (var k in keys) {
            var l = model.links.get(keys[k]);
            var src_found = 0;
            var dst_found = 0;
            var sel = 0;

            for (var i = 0, row; row = leftTable.table.rows[i]; i++) {
                if (row.cells[0].textContent == l.src) {
                    var src = row;
                    src_found = 1;
                }
                if (row.cells[0].textContent == l.dst) {
                    var dst = row;
                    dst_found = 1;
                }
                if (src_found && dst_found)
                    break;
            }
            if (!src_found || !dst_found) {
                for (var i = 0, row; row = rightTable.table.rows[i]; i++) {
                    if (row.cells[0].textContent == l.src) {
                        var src = row;
                        src_found = 2;
                    }
                    if (row.cells[0].textContent == l.dst) {
                        var dst = row;
                        dst_found = 2;
                    }
                    if (src_found && dst_found)
                        break;
                }
            }
            if (src_found && dst_found) {
                if (model.selectedLinks.indexOf(keys[k]) > -1)
                    sel = 1;
                // Are these rows being displayed?
                if ($(src).css('display') != 'none'
                    && $(dst).css('display') != 'none') {
                    var num_maps = (l.num_maps[0] + l.num_maps[1]);
                    create_arrow(src, dst, src_found | (dst_found << 2),
                                 sel, 0, l.num_maps, num_maps.toString());
                    n_visibleLinks++;
                }
            }
        }

        $('.status.middle').text(
            n_visibleLinks + " of " + model.links.keys().length + " links");
    }

    // Prevent this function from being called more than once within timeout.
    var arrowTimeout;
    var arrowCallable = true;
    var timesArrowsCalled = 0;

    function update_arrows()
    {
        if (arrowCallable == false) {
            clearTimeout(arrowTimeout);
        }
        timesArrowsCalled++;

        arrowCallable = false;
        arrowTimeout = setTimeout(function() {

            if (selectedTab == all_devices)
                update_links();
            else
                update_maps();
            arrowCallable = true;
        }, 0);
    }

    function update_maps()
    {
        cleanup_arrows();
        var n_maps = 0;
        var n_visibleMaps = 0;

        var keys = model.maps.keys();
        for (var k in keys) {
            var c = model.maps.get(keys[k]);
            var muted = c.muted;
            var src_found = 0;
            var dst_found = 0;
            var sel = 0;

            for (var i = 0, row; row = leftTable.table.rows[i]; i++) {
                if (row.cells[0].textContent == c.src) {
                    var src = row;
                    src_found = 1;
                }
                else if (row.cells[0].textContent == c.dst) {
                    var dst = row;
                    dst_found = 1;
                }
                if (src_found && dst_found)
                    break;
            }
            if (!src_found || !dst_found) {
                for (var i = 0, row; row = rightTable.table.rows[i]; i++) {
                    if (row.cells[0].textContent == c.src) {
                        var src = row;
                        src_found = 2;
                    }
                    else if (row.cells[0].textContent == c.dst) {
                        var dst = row;
                        dst_found = 2;
                    }
                    if (src_found && dst_found)
                        break;
                }
            }
            if (src_found && dst_found) {
                if (selectedTab == all_devices) {
                    if (model.selectedLinks.indexOf(keys[k]) > -1)
                        sel = 1;
                }
                else if (model.selectedMaps.indexOf(keys[k]) > -1)
                    sel = 1;
                // Are these rows being displayed?
                if ($(src).css('display') != 'none'
                    && $(dst).css('display') != 'none') {
                    create_arrow(src, dst, src_found | (dst_found << 2),
                                 sel, c.muted, [1, 0], null);
                    n_visibleMaps++;
                }
                n_maps++;
            }
        }

        $('.status.middle').text(
            n_visibleMaps + " of " + n_maps + " maps");

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

        update_arrows();
        $(leftTable.table).trigger('update');
        $(rightTable.table).trigger('update');

        rightTable.set_status();
        leftTable.set_status();

        update_row_heights();
    }

    function filter_match(row)
    {
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

    /* Returns whether a row has a map, have to do it based on db.maps not
     * arrows themselves. */
    function is_mapped(row) {
        // What is the name of the signal/link?
        var name = $(row).children('.name').text();
        var linkConList = [];   // A list of all links or maps in 'devA>devB' form
        var srcNames = [];      // All source names as strings
        var dstNames = [];     // All destination names as strings

        if (selectedTab == all_devices)
            linkConList = model.links.keys();
        else
            linkConList = model.maps.keys();

        for (var i in linkConList) {
            var sd = linkConList[i].split('>');
            srcNames[i] = sd[0];
            dstNames[i] = sd[1];
        }

        for (var i in srcNames) {
            // Does the name match a string in the maps/links?
            if (srcNames[i] == name || dstNames[i] == name)
                return true;
        }

        return false;
    }

    /* params are TR elements, one from each table */
    function create_arrow(src, dst, geometry, sel, muted, arrowheads, label) {
        var line = svgArea.path();
        var bidirectional = 0;//selectedTab == all_devices;

        line.border = svgArea.path();
        line.border.attr({
            "stroke": "blue",
            "fill": "none",
            "stroke-width": "10pt",
            "stroke-opacity": 0,
            "cursor": "pointer",
            "border": "1px solid blue"
        });

        var arrow_offset = 6;

        var S = fullOffset(src);
        var D = fullOffset(dst);
        var frame = fullOffset($('#svgDiv')[0]);

        if (geometry & 1)
            var x1 = arrowheads[1] ? arrow_offset : 0;
        else
            var x1 = frame.width - (arrowheads[1] ? arrow_offset : 0);
        var y1 = S.top + S.height / 3 - frame.top;

        if ((geometry >> 2) & 1)
            var x2 = arrowheads[0] ? arrow_offset : 0;
        else
            var x2 = frame.width - (arrowheads[0] ? arrow_offset : 0);
        var y2 = D.top + D.height / 1.5 - frame.top;

        var path = [["M", x1, y1],
                    ["C", frame.width / 2, y1, frame.width / 2, y2, x2, y2]];

        line.attr({"path": path});
        line.border.attr({"path": path});
        line.attr({
            "fill": "none",
            "stroke-width": "2px",
            "cursor": "pointer",
        });
        if (arrowheads[0] > 0)
            line.attr({"arrow-end": "classic-wide-long"});
        if (arrowheads[1] > 0)
            line.attr({"arrow-start": "classic-wide-long"});

        if (label != null) {
            width = label.length * 12;
            if (width < 20)
                width = 20;
            if (Math.abs(x1 - x2) <= arrow_offset)
                center_x = frame.width / 2 + (x1 <= arrow_offset ? -35 : 35);
            else
                center_x = frame.width / 2;
            center_y = (y1 + y2) / 2;
            var rect = svgArea.rect(center_x - width/2, center_y-10, width, 20, 10);
            // todo: move to css
            if (sel)
                rect.attr({"fill": "red", "stroke": "none"});
            else
                rect.attr({"fill": "black", "stroke": "none"});
            var text = svgArea.text(center_x, center_y, label);
            text.attr({"font-size": 14, "fill": "#FFF", "text-align": "center"});

            line.label = text;
            line.label_background = rect;
        }

        if (sel)
            line.node.classList.add('selected');
        if (muted)
            line.node.classList.add('muted');

        // So that the arrow remembers which rows it is attached to
        line.srcTr = src;
        line.dstTr = dst;

        arrows.push(line);
        $('#container').trigger("updateMapProperties");

        // TODO move this with all the other UI handlers
        $(line.border.node).on('click', function(e) {

            var _src = $(src).children('.name').text();
            var _dst = $(dst).children('.name').text();

            // So that the arrow is deselected if both rows are selected
            // selected, so deselect it
            if (selectedTab == all_devices) {
                if (e.shiftKey == false)
                    deselect_all();
                    if (model.selectedLinks_toggleLink(_src, _dst))
                        update_arrows();
            }
            // not selected, so select it
            else {
                if (e.shiftKey == false)
                    deselect_all();
                if (model.selectedMaps_toggleMap(_src, _dst))
                    update_arrows();
            }
            $('#container').trigger("updateMapProperties");

            e.stopPropagation();
        });
    }

    function select_tab(tab)
    {
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
        view.update_display();
    }

    function select_tr(tr)
    {
        if (!tr) return;

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

    function deselect_all()
    {
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
        update_arrows();
        model.selectedLinks_clearAll();
        model.selectedMaps_clearAll();
        $('#container').trigger("updateMapProperties");
    }

    function select_all()
    {
        deselect_all();
        for (var i in arrows) {
            // Test to see if those rows are already selected
            // (select_tr() just toggles selection)
            arrows[i].attr('stroke', 'red');
            if (! $(arrows[i].srcTr).hasClass('trsel'))
                select_tr(arrows[i].srcTr);
            if (! $(arrows[i].dstTr).hasClass('trsel'))
                select_tr(arrows[i].dstTr);

            var _src = arrows[i].srcTr.cells[0].textContent;
            var _dst = arrows[i].dstTr.cells[0].textContent;
            if (selectedTab == all_devices)
                model.selectedLinks_toggleLink(_src, _dst);
            else
                model.selectedMaps_toggleMap(_src, _dst);
        }
        update_arrows();
    }

    function on_table_scroll()
    {
        if (selectedTab == all_devices) {
            // TODO: should check first to see if scroll was vertical
            update_links();
        }
        else
            update_maps();
    }

    function on_link(e, start, end) {
        if (start && end)
            $('#container').trigger("link", [start.cells[0].textContent,
                                             end.cells[0].textContent]);
        e.stopPropagation();
    }

    function on_unlink(e) {
        for (var key in model.selectedLinks) {
            var link = model.links.get(key);
            $('#container').trigger("unlink", [link.src, link.dst]);
        }
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
        for (var key in model.selectedMaps) {
            var map = model.maps.get(key);
            $('#container').trigger("unmap", [map.src, map.dst]);
        }
        e.stopPropagation();
    }

    function add_tabs()
    {
        $('#container').append(
            "<ul class='topTabs'>"+
                "<li id='allDevices'>"+all_devices+"</li>"+
            "</ul>");
        tabList = $('.topTabs')[0];
        tabDevices = $('#allDevices')[0];

        selectedTab = all_devices;
    }

    function add_title_bar()
    {
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

    function add_display_tables()
    {
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


    function add_svg_area()
    {
        $('#container').append(
            "<div id='svgDiv'>"+
                "<div id='svgTop'>hide unmapped</div>"+
            "</div>");

        svgArea = Raphael($('#svgDiv')[0], '100%', '100%');

    }

    function add_status_bar()
    {
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

    function drawing_curve(sourceRow)
    {
        var self = this;
        this.sourceRow = sourceRow;
        this.targetRow;
        this.muted = false;
        var allow_self_link = selectedTab == all_devices;

        this.canvasWidth = $('#svgDiv').width();

        this.clamptorow = function(row) {
            var svgPos = fullOffset($('#svgDiv')[0]);
            var rowPos = fullOffset(row);
            var y = rowPos.top + rowPos.height/2 - svgPos.top;
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
            if (!incompatible)
                return row;
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
        this.path[0][2] = this.clamptorow(this.sourceRow);

        // The actual line
        this.line = svgArea.path();
        this.line.attr({"stroke-width": "2px",
                        "arrow-end": "classic-wide-long"});

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
                        fade_incompatible_signals(this.sourceRow,
                                                  this.targetTable.tbody);
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
                            end[0] = this.canvasWidth - start[0];
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow);
                        this.checkTarget(clampRow);
                    }
                    else
                        this.checkTarget(null);
                }
                else if (this.canvasWidth - absdiff < 50) {
                    var clampRow = this.findrow(end[1]);
                    if (clampRow) {
                        end[0] = this.canvasWidth - start[0];
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow);
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
                if (this.sourceTable == this.targetTable)
                    end[0] = start[0];
                else
                    end[0] = this.canvasWidth - start[0];
                end[1] = this.clamptorow(target);
            }
            this.path = get_bezier_path(start, end, c1, this.canvasWidth);
            this.line.attr({"path": this.path});
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
        };

        // Check if we have a new target row, select it if necessary
        this.checkTarget = function(mousedOverRow) {
            if (this.targetRow == mousedOverRow
                || $(mousedOverRow).hasClass('incompatible')
                || (this.sourceRow == this.targetRow && !allow_self_link))
                return;
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

    function fade_incompatible_signals(row, targetTableBody) {
        for (var i in arrows) {
            if (arrows[i].srcTr == row)
                $(arrows[i].dstTr).addClass('incompatible');
            else if (arrows[i].dstTr == row)
                $(arrows[i].srcTr).addClass('incompatible');
        }
    }

    function drawing_handlers()
    {
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

    this.add_handlers = function()
    {
        $('#container').on('click.list', function() {
            deselect_all();
        });

        $('.displayTable tbody').on({
            mousedown: function(e) {
                if (e.shiftKey == true)    // For selecting multiple rows at once
                    full_select_tr(this);
                else
                    deselect_all();
                select_tr(this);
                update_arrows();
            },
            click: function(e) { e.stopPropagation(); }
        }, 'tr');

        // For redrawing arrows upon table sort
        $('.displayTable thead').on('click', 'th', function(e) {
            e.stopPropagation();
            $(this).parents(".displayTable").one('sortEnd', function() {
                update_arrows();
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
            update_arrows();
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
    }
}
