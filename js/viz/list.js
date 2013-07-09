//An object for the overall display
function listView(model)
{

	this.model = model;
	
    var svgns = 'http://www.w3.org/2000/svg';

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

    var sourceDeviceHeaders = ["name", "outputs", "IP", "port"];
    var destinationDeviceHeaders = ["name", "inputs", "IP", "port"];
    var signalHeaders = ["name", "type", "length", "units", "min", "max"];

    //"use strict";
    this.type = 'list';
    this.unconnectedVisible = true // Are unconnected devices/signals visible?
    this.focusedDevices = [] // An array containing devices seen in the display

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
            'min-height': '150px'
        });
        this.update_display();
    }

    this.cleanup = function() {
        // Remove view specific handlers
        $('*').off('.list');
    }

    var updateCallable = true;
    var updateTimeout;
    var timesUpdateCalled = 0;
    this.update_display = function() {

        if (updateCallable == false) {
            clearTimeout(updateTimeout);
        }

        updateCallable = false;
        updateTimeout = setTimeout(function() {
            timesUpdateCalled++;
            //console.log("Update: "+timesUpdateCalled);
            
            // Removes 'invisible' classes which can muddle with display updating
            $('tr.invisible').removeClass('invisible');
            update_arrows();

            update_tabs();
            if (selectedTab == all_devices) {
                update_devices();
                window.saveLocation = '';
            }
            else {
                update_signals(selectedTab);
                window.saveLocation = '/save?dev='+encodeURIComponent(selectedTab);
            }

            update_save_location();

            update_selection();
            
            filter_view();

            //Because svg keeps getting nudged left for some reason
            //$('svg').css('left', '0px');
            update_row_heights();
            //$('.displayTable tr, #svgTop').css('height', ($(window).height() * 0.05) + "px");

            updateCallable = true;

        }, 34);


    }

    this.get_selected_connections = function(list)
    {
        var L = $('.trsel', leftTable.table);
        var R = $('.trsel', rightTable.table);
        var vals = [];

        L.map(function() {
            var left = this;
            R.map(function() {
                var right = this;
                var key = left.firstChild.innerHTML+'>'+right.firstChild.innerHTML;
                var v = list.get(key);
                if (v)
                    vals.push(v);
            });
        });
        return vals;
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
                var destD = model.devices.get(devs[1]);
                focusedDevices.add(destD.name, destD);
            }
        }

        return focusedDevices;
    }

    this.on_resize = function() 
    {
        update_arrows();
        update_row_heights();
        //$('.displayTable tr, #svgTop').css('height', ($(window).height() * 0.05) + "px");
    }

//A function to make sure that rows fill up the available space, in testing for now
function update_row_heights()
{
    var tableHeight = $('.tableDiv').height() - $('.tableDiv thead').height();
    var leftHeight = Math.floor(tableHeight/leftTable.nVisibleRows);
    var rightHeight = Math.floor(tableHeight/rightTable.nVisibleRows);

    $('#leftTable tbody tr').css('height', leftHeight+'px');
    $('#rightTable tbody tr').css('height', rightHeight+'px');
}

//An object for the left and right tables, listing devices and signals
function listTable(id)
{ 
    this.id = id; //Something like "leftTable"
    this.parent; //The node containing the table
    this.div; //The div node (and status)
    this.table; //The table node itself
    this.headerRow; //The top row node of the table within <thead>
    this.tbody; //The <tbody> node
    this.footer; //The status bar at the bottom

    this.nRows; //Number of rows (e.g. devices or signals) present
    this.nVisibleRows; //Number of rows actually visible to the user
    this.nCols; //Number of columns in table

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
            "</table>"
        );
        this.table = $(this.div).children('.displayTable')[0];
        this.headerRow = $("#"+this.id+" .displayTable thead tr")[0];
        this.tbody = $("#"+this.id+" .displayTable tbody")[0];

        //Create the header elements
        //This assumes that we will never need more than 20 columns
        //Creating and distroying th elements themselves screws up tablesorter
        for(var i=0; i<20; i++) {
            $(this.headerRow).append("<th class='invisible'></th>");
        }
    }

    // e.g. headerStrings = ["Name", "Units", "Min", "Max"]
    this.set_headers = function(headerStrings)
    {
        this.nCols = headerStrings.length; 

        $(this.headerRow).children('th').each(function(index) {
            if(index < headerStrings.length)
                $(this).text(headerStrings[index]).removeClass("invisible");
            else
                $(this).text("").addClass("invisible");
        });
    }

    // For when something changes on the network
    this.update = function(tableData, headerStrings)
    {
        $(this.tbody).empty();
        for(var row in tableData) 
        {
            //If there is only one row, make it of even class for styling
            var newRow = "<tr>"
            for(var col in tableData[row]) {
                newRow += "<td class="+headerStrings[col]+">"+tableData[row][col]+"</td>";
            }
            $(this.tbody).append(newRow+"</tr>");
        }
        this.nRows = tableData.length;
        if(tableData[0])
            this.nCols = tableData[0].length;
        $(this.table).trigger('update');
    }

    this.set_status = function() {
        var name; //Devices or signals
        if( selectedTab == all_devices ) {
            name = "devices";
        }
        else name = "signals";
        this.nVisibleRows = $(this.tbody).children('tr').length - $(this.tbody).children('tr.invisible').length;
        $(this.footer).text(this.nVisibleRows+" of "+this.nRows+" "+name);
    
        // For styling purposes when there is only a single row
        if (this.nVisibleRows == 1) 
            $(this.tbody).children('tr').addClass('even');
    }

}

function update_devices()
{
    var keys = this.model.devices.keys();

    var leftBodyContent = [];
    var rightBodyContent = [];

    leftTable.set_headers(sourceDeviceHeaders);
    rightTable.set_headers(destinationDeviceHeaders);    
    
    for (var d in keys) {
        var k = keys[d];
        var dev = this.model.devices.get(k);

        if (dev.n_outputs){
            leftBodyContent.push([dev.name, dev.n_outputs, dev.host, dev.port]);}
        if (dev.n_inputs){
            rightBodyContent.push([dev.name, dev.n_inputs, dev.host, dev.port]);}
        
    }

    leftTable.set_status();
    rightTable.set_status();

    leftTable.update(leftBodyContent, sourceDeviceHeaders);
    rightTable.update(rightBodyContent, destinationDeviceHeaders);
}


function update_signals()
{
    var keys = this.model.signals.keys();
    
    var leftBodyContent = [];
    var rightBodyContent = [];
    
    for (var s in keys) {
        var k = keys[s];
        var sig = this.model.signals.get(k);
        var lnk = this.model.links.get(selectedTab+'>'+sig.device_name);

        if (sig.device_name == selectedTab && sig.direction == 1){
            leftBodyContent.push([sig.device_name+sig.name, sig.type, sig.length, sig.unit, sig.min, sig.max]);
        }
        if (sig.direction == 0 && lnk!=null){
            rightBodyContent.push([sig.device_name+sig.name, sig.type, sig.length, sig.unit, sig.min, sig.max]);
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
    var keys = this.model.links.keys();
    var srcs = {};
    for (var l in keys)
        srcs[this.model.links.get(keys[l]).src_name] = null;
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

function update_selection()
{
    var l = selectLists[selectedTab];
    if (!l) return;

    function checksel(table, i) {
        if (!selectLists[selectedTab])
            return;
        var l = selectLists[selectedTab][i];
        var tr = $(table).children('tbody').children('tr')[0];
        while (tr) {
            if (l.get(tr.firstChild.innerHTML))
                $(tr).addClass("trsel");
            else
                $(tr).removeClass("trsel");
            tr = tr.nextSibling;
        }
    }

    checksel(leftTable.table, 0);
    checksel(rightTable.table, 1);
}

function cleanup_arrows()
{
    for (var a in arrows) {
        arrows[a].border.remove();
        arrows[a].remove();
    }
    arrows = [];
}

//What the heck is this?
$.expr[":"].endswith = function(obj, index, meta, stack){
return (obj.textContent || obj.innerText || $(obj).text() || "").indexOf(meta[3]) >=0 && (obj.textContent || obj.innerText || $(obj).text() || "").indexOf(meta[3]) == ((obj.textContent || obj.innerText || $(obj).text() || "").length - meta[3].length);
}

function update_links()
{
    cleanup_arrows();

    // How many are actually being displayed?
    var n_visibleLinks = 0;

    var keys = this.model.links.keys();
    for (var k in keys) {
        var l = this.model.links.get(keys[k]);
        // TODO: need to use exact match instead of endswith here since
        // names are arbitrary and could have substring matches
        $('td:endswith('+l.src_name+')', leftTable.table).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:endswith('+l.dest_name+')', rightTable.table).each(
                    function(i,e){
                        var right = e.parentNode;
                        var rightsel = $(right).hasClass('trsel');
                        //Make sure that the row is not hidden
                        if( $(left).css('display') != "none" && $(right).css('display') != "none" ) {
                            create_arrow(left, right, leftsel && rightsel, 0);
                            n_visibleLinks++;
                        }
                    });
            });
    }

    $('.status.middle').text(
        n_visibleLinks + " of " + this.model.links.keys().length + " links"
    );

}

//Because this is a heavy function, I want to prevent it from being called too rapidly
//(it is also never necessary to do so)
//It is currently called with a delay of 34ms, if it is called again within that delay
//The first call is forgotten.
var arrowTimeout;
var arrowCallable = true;
var timesArrowsCalled = 0;

function update_arrows()
{
    if (arrowCallable == false) {
        clearTimeout(arrowTimeout);
    }
    timesArrowsCalled++;
    //console.log("Arrows: "+timesArrowsCalled);

    arrowCallable = false;
    arrowTimeout = setTimeout( function() {

        if (selectedTab == all_devices)
            update_links();
        else
            update_connections();
        arrowCallable = true;
    }, 0);
}

function update_connections()
{
    cleanup_arrows();
    var n_connections = 0;
    var n_visibleConnections = 0;

    var keys = this.model.connections.keys();
    for (var k in keys) {
        var c = model.connections.get(keys[k]);
        var muted = c.muted;
        // TODO: need to use exact match instead of endswith here since
        // names are arbitrary and could have substring matches
        $('td:endswith('+c.src_name+')', leftTable.table).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:endswith('+c.dest_name+')', rightTable.table).each(
                    function(i,e){
                        var right = e.parentNode;
                        var rightsel = $(right).hasClass('trsel');
                        //Are these rows being displayed?
                        if( $(left).css('display') != 'none' && $(right).css('display') != 'none' ) {
                            create_arrow(left, right, leftsel && rightsel, muted);
                            n_visibleConnections++;
                        }
                        n_connections++;
                    });
            });
    }

    $('.status.middle').text(
        n_visibleConnections + " of " + n_connections + " connections"
    );
}

//A function for filtering out unconnected signals
//Or signals that do not match the search string
function filter_view()
{
    $('.displayTable tbody tr').each( function(i, row) {
        if( (view.unconnectedVisible || is_connected(this) ) && filter_match(this) ) 
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
    //Test to see if the row is on the left or right table
    if( $(row).parents('.tableDiv').is('#leftTable') ) 
        filterText = $('#leftSearch').val();
    else if ( $(row).parents('.tableDiv').is('#rightTable') )
        filterText = $('#rightSearch').val();
    else
        console.log("Error, "+row+" belongs to neither table");

    var found = false;
    // Iterate over every cell of the row
    $(row).children('td').each( function(i, cell) {
        var regExp = new RegExp(filterText, 'i');
        // Is the search string found?
        if( regExp.test($(cell).text()) ) { 
            found = true;
        }
    });

    if(found)
        return true
    else
        return false;
}

// Returns whether a row has a connection, have to do it based on monitor.connections
// not arrows themselves
function is_connected(row) 
{
    // What is the name of the signal/link?
    var name = $(row).children('.name').text();
    var linkConList = [];   // A list of all links or connections in 'devA>devB' form
    var srcNames = [];      // All source names as strings
    var destNames = [];     // All dest names as strings

    if ( selectedTab == all_devices ) {
        linkConList = model.links.keys();
    }
    else linkConList = model.connections.keys();

    for (var i in linkConList) {
        var sd = linkConList[i].split('>');
        srcNames[i] = sd[0];
        destNames[i] = sd[1];
    }

    for( var i in srcNames ) {
        //Does the name match a string in the connections/links?
        if( srcNames[i] == name || destNames[i] == name ) 
            return true;
    }

    return false;
}

/* params are TR elements, one from each table */
function create_arrow(left, right, sel, muted)
{
    var line = svgArea.path();
    
    line.border = svgArea.path();
    line.border.attr({
        "stroke": "blue",
        "fill": "none",
        "stroke-width": "10pt",
        "stroke-opacity": 0,
        "cursor": "pointer",
        "border": "1px solid blue"
    });

    var L = fullOffset(left);
    var R = fullOffset(right);
    var S = fullOffset($('.svgDiv')[0]);

    var x1 = 0;
    var y1 = L.top+L.height/2-S.top;

    var x2 = S.width;
    var y2 = R.top+R.height/2-S.top;

    var path = [ ["M", x1, y1] , ["C", (x1+x2)/2, y1, (x1+x2)/2, y2, x2, y2]];

    line.attr({"path": path});
    line.border.attr({"path": path});

    if (sel)
        line.node.classList.add('selected');
    if (muted)
        line.node.classList.add('muted');

    line.attr({
        "fill": "none",
        "stroke-width": 1.5,
        "cursor": "pointer"
    });

    // So that the arrow remembers which rows it is attached to
    line.rightTr = right;
    line.leftTr = left;

    arrows.push(line);

    //TODO move this with all the other UI handlers
    $(line.border.node).on('click', function(e) {
        //So that the arrow is deselected if both rows are selected
        if( $(right).hasClass('trsel') && $(left).hasClass('trsel') ) {
            select_tr(left);
            select_tr(right);
        }
        else {
            if( ! $(left).hasClass('trsel') )
                select_tr(left);
            if( ! $(right).hasClass('trsel') )
                select_tr(right);
            line.node.classList.add('selected');
        }
        update_connection_properties();
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
        leftTable.set_headers(sourceDeviceHeaders);
        rightTable.set_headers(destinationDeviceHeaders);
        $('#saveLoadDiv').addClass('disabled');
    }
    else {
        $('#svgTitle').text("Connections");
        leftTable.set_headers(signalHeaders);
        rightTable.set_headers(signalHeaders);
        $('#saveLoadDiv').removeClass('disabled');
    }

    view.unconnectedVisible = true;
    $('svgTop').text('hide unconnected');
    $('#leftSearch, #rightSearch').val('');
    command.send('tab', selectedTab);
    view.update_display();
}

function select_tr(tr)
{
    if(!tr) return;

    var t = $(tr);
    var name = tr.firstChild.innerHTML;

    //Is the row on the left or right?
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

    if(i == 0) // Left table
        lastSelectedTr.left = tr;
    else if (i == 1)
        lastSelectedTr.right = tr;

    selectLists[selectedTab][i] = l;
}

//For selecting multiple rows with the 'shift' key
function full_select_tr(tr)
{
    var targetTable = $(tr).parents('.tableDiv').attr('id') == 'leftTable' ? '#leftTable' : '#rightTable';
    var trStart = targetTable == '#leftTable' ? lastSelectedTr.left : lastSelectedTr.right;
    if( !trStart ) {
        return;
    }

    var index1 = $(tr).index();
    var index2 = $(trStart).index();

    var startIndex = Math.min(index1, index2);
    var endIndex = Math.max(index1, index2);

    $(''+targetTable+' tbody tr').each( function(i, e) {
        if( i > startIndex && i < endIndex && !$(e).hasClass('invisible') && !$(e).hasClass('trsel') ) {
            select_tr(e);
            update_connection_properties();
        }
    });
}

function deselect_all()
{
    $('tr.trsel', leftTable.table).each(function(i,e){
            selectLists[selectedTab][0].remove(e.firstChild.innerHTML);
            $(this).removeClass('trsel');
        });
    $('tr.trsel', rightTable.table).each(function(i,e){
            selectLists[selectedTab][1].remove(e.firstChild.innerHTML);
            $(this).removeClass('trsel');
        });
    lastSelectedTr.left = null;
    lastSelectedTr.right = null;
    update_arrows();
    update_connection_properties();
}

function select_all()
{
    deselect_all();
    // Need the var! Damn variable scope
    for(var i in arrows ) {
        //Test to see if those rows are already selected
        //(select_tr() just toggles selection)
        arrows[i].attr('stroke', 'red');
        if( ! $(arrows[i].leftTr).hasClass('trsel') )
            select_tr(arrows[i].leftTr);
        if( ! $(arrows[i].rightTr).hasClass('trsel') )
            select_tr(arrows[i].rightTr);
    }
    update_connection_properties();
}

function on_table_scroll()
{
    if (selectedTab == all_devices)
    // TODO: should check first to see if scroll was vertical
        update_links();
    else
        update_connections();
}

function apply_selected_pairs(f)
{
    $('tr.trsel', leftTable.table).each(
    function(i,e){
        var left = e;
        $('tr.trsel', rightTable.table).each(
            function(i,e){
                var right = e;
                f(left, right);
            });
    });
}

function on_link(e)
{
    function do_link(l, r) {
        command.send('link', [l.firstChild.innerHTML,
                              r.firstChild.innerHTML]);
    }
    apply_selected_pairs(do_link);
    e.stopPropagation();
}

function on_unlink(e)
{
    function do_unlink(l, r) {
        command.send('unlink', [l.firstChild.innerHTML,
                                r.firstChild.innerHTML]);
    }
    apply_selected_pairs(do_unlink);
    e.stopPropagation();
}

function on_connect(e)
{
    function do_connect(l, r) {
        command.send('connect', [l.firstChild.innerHTML,
                                 r.firstChild.innerHTML]);
    }
    apply_selected_pairs(do_connect);
    e.stopPropagation();
}

function on_disconnect(e)
{
    function do_disconnect(l, r) {
        command.send('disconnect', [l.firstChild.innerHTML,
                                    r.firstChild.innerHTML]);
    }
    apply_selected_pairs(do_disconnect);
    e.stopPropagation();
}

function add_tabs()
{
    $('#container').append(
        "<ul class='topTabs'>"+
            "<li id='allDevices'>"+all_devices+"</li>"+
        "</ul>"
    );
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
        "</div>"
    );
    var $titleSearchDiv = $('<div id="titleSearchDiv"></div>');
}

function add_display_tables()
{
    //Make the spacer table, how the elements locate themselves on the page
    /*$('#container').append(
        "<table id='spacerTable'><tr><td></td><td></td><td></td></tr></table>"
    );*/

    leftTable = new listTable('leftTable');
    rightTable = new listTable('rightTable');

    //Put the tables in the DOM
    leftTable.create_within( $('#container')[0] );
    rightTable.create_within( $('#container')[0] );

    leftTable.set_headers(['device', 'outputs', 'IP', 'port']);
    rightTable.set_headers(['device', 'input', 'IP', 'port']);

    $(leftTable.table).tablesorter({widgets: ['zebra']});
    $(rightTable.table).tablesorter({widgets: ['zebra']});
}


function add_svg_area()
{
    $('#container').append(
        "<div class='svgDiv'>"+
            "<div id='svgTop'>hide unconnected</div>"+
        "</div>"
    );

    svgArea = Raphael( $('.svgDiv')[0], '100%', '100%');
    
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
        "</table>"
    );

    leftTable.footer = $("#statusBar .left")[0];
    rightTable.footer = $("#statusBar .right")[0];
}

function drawing_curve(sourceRow)
{
    var self = this;
    this.sourceRow = sourceRow;
    this.targetRow;
    // We'll need to know the width of the canvas, in px, as a number
    var widthInPx = $('svg').css('width'); // Which returns "##px"
    this.canvasWidth = +widthInPx.substring(0, widthInPx.length - 2); // Returning a ##
    
    this.clamptorow = function( row ) {
        var svgPos = fullOffset($('.svgDiv')[0]);
        var rowPos = fullOffset(row);
        var y = rowPos.top + rowPos.height/2 - svgPos.top;
        return y;
    }

    this.findrow = function ( y ) {
        var svgTop = $('.svgDiv').offset().top;  // The upper position of the canvas (so that we can find the absolute position)
        var ttleft = $(this.targetTable.tbody).offset().left; // Left edge of the target table
        var td = document.elementFromPoint( ttleft, svgTop + y ); // Closest table element (probably a <td> cell)
        var row = $(td).parents('tr')[0]; 
        var incompatible = $(row).hasClass('incompatible');
        if( !incompatible )
            return row;
    }

    // Our bezier curve points
    this.path = [ ["M"], ["C"]];

    // Are we aiming for the left or right table?
    this.targetTable;
    if( $(this.sourceRow).parents('.tableDiv').attr('id') == "leftTable" ) {
        this.targetTable = rightTable;
        this.path[0][1] = 0; // Start the curve at left
    }
    else {
        this.targetTable = leftTable;
        this.path[0][1] = this.canvasWidth; // Start the curve at right
    }

    this.path[0][2] = this.clamptorow(this.sourceRow) // And in the middle of the starting row

    // The actual line
    this.line = svgArea.path().attr({'stroke-width': 2});

    this.update = function( moveEvent ) {
        var target = moveEvent.currentTarget;
        var start = [ this.path[0][1], this.path[0][2] ];
        var end = [ this.path[1][5], this.path[1][6] ];
        var c1;
        if( target.tagName == "svg" ) {
            end = [ moveEvent.offsetX, moveEvent.offsetY ];
            // Within clamping range
            if( this.canvasWidth - Math.abs(end[0] - start[0]) < 50) {
                var clampRow = this.findrow(end[1]);
                if(clampRow) {
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
        if( $(target).parents('tbody')[0] == this.targetTable.tbody ) {
            var rowHeightPx = $(target).css('height');
            var rowHeight = +rowHeightPx.substring(0, rowHeightPx.length - 2);
            this.checkTarget(target);
            end[0] = this.canvasWidth - start[0];
            end[1] = this.clamptorow(target);
            c1 = end[1] + moveEvent.offsetY - rowHeight/2;
        }
        this.path = get_bezier_path(start, end, c1);
        this.line.attr({'path': this.path});
    }

    this.mouseup = function( mouseUpEvent ) {
        if (selectedTab == all_devices) on_link(mouseUpEvent);
        else on_connect(mouseUpEvent);
        $("*").off('.drawing').removeClass('incompatible');
        //So that the old line is only removed when the actual connection is made
        self.line.remove();
    }

    this.checkTarget = function( mousedOverRow ) {
        if(this.targetRow != mousedOverRow ) {
            if(this.targetRow != null && !$(this.targetRow).hasClass('incompatible')) {
                update_connection_properties();
                select_tr(this.targetRow);
            }

            if( !$(mousedOverRow).hasClass('incompatible') )
                this.targetRow = mousedOverRow;
            else
                this.targetRow = null;

            if(this.targetRow && !$(this.targetRow).hasClass('incompatible') ) {
                update_connection_properties();
                select_tr(this.targetRow);
            }
        }
    }
}

function drawing_handlers()
{
    // Wait for a mousedown on either table
    // Handler is attached to table, but 'this' is the table row
    $('.displayTable').on('mousedown', 'tr', function(tableClick) {

        var sourceRow = this;

        // Cursor enters the canvas
        $('svg').one('mouseenter.drawing', function() {

            var curve = new drawing_curve(sourceRow);

            // Make sure only the proper row is selected
            deselect_all();
            select_tr(curve.sourceRow);
            update_connection_properties();

            // Fade out incompatible signals
            if( selectedTab != all_devices )
                fade_incompatible_signals(curve.sourceRow, curve.targetTable.tbody);

            // Moving about the canvas
            $('svg, .displayTable tbody tr').on('mousemove.drawing', function(moveEvent) {
                curve.update(moveEvent);
            });

            $(document).one('mouseup.drawing', function(mouseUpEvent) {
                curve.mouseup(mouseUpEvent);
            });
        });

        $(document).one('mouseup.drawing', function(mouseUpEvent) {
            $("*").off('.drawing').removeClass('incompatible');
        });
    });
}

// Finds a bezier curve between two points
function get_bezier_path(start, end, controlEnd) 
{
    // 'Move to': (x0, y0), 'Control': (C1, C2, end)
    var path = [ ["M", start[0], start[1]], ["C"]];

    // x-coordinate of both control points
    path[1][1] = path[1][3] = (end[0] + start[0]) / 2
    // y-coordinate of first control point
    path[1][2] = start[1];
    // y-coordinate of second control point
    if(controlEnd)
        path[1][4] = controlEnd;
    else path[1][4] = end[1];

    // Finally, the end points
    path[1][5] = end[0];
    path[1][6] = end[1];

    return path;
}

function fade_incompatible_signals(row, targetTableBody)
{
    var sourceLength = $(row).children('.length').text();
    
    $(targetTableBody).children('tr').each( function(index, element) {
        var targetLength =  $(element).children('.length').text();
        if( sourceLength != targetLength ) 
            $(element).addClass('incompatible');
    }); 
}

this.add_handlers = function()
{
    $('#container').on('click.list', function() {
        deselect_all();
    });

    $('.displayTable tbody').on({
        mousedown: function(e) { 
            if(e.shiftKey == true)    // For selecting multiple rows at once
                full_select_tr(this);
            select_tr(this);
            update_connection_properties();
            update_arrows(); 
        },
        click: function(e) { e.stopPropagation(); }
    }, 'tr');

    //For redrawing arrows upon table sort
    $('.displayTable thead').on('click', 'th', function(e) {
        e.stopPropagation();
        $(this).parents(".displayTable").one('sortEnd', function() {
            update_arrows();
        });
    });

    // Various keyhandlers
    $('body').on('keydown.list', function(e) {
        if (e.which == 67) { // connect on 'c'
            if (selectedTab == all_devices) 
                on_link(e);
            else
                on_connect(e);
        }
        else if (e.which == 8) { // disconnect on 'delete'
            //Prevent the browser from going back a page
            //but NOT if you're focus is an input and deleting text
            if( !$(':focus').is('input') ) {
                e.preventDefault();
            }
            if (selectedTab == all_devices) 
                on_unlink(e);
            else
                on_disconnect(e);
            deselect_all();
        }
        else if (e.which == 65 && e.metaKey == true) { // Select all 'cmd+a'
            select_all();
        }
        else if (e.which == 9 && e.altKey == true) { // Tabbing like in google chrome 'alt-tab'
            e.preventDefault();
            var n_tabs = $('.topTabs li').length;
            var currentTabIndex = $('li.tabsel').index() + 1;
            var nextTabIndex;
            if (e.shiftKey == false) { //Tabbing forwards
                if (currentTabIndex < n_tabs)
                    nextTabIndex = currentTabIndex + 1
                else // If we're at the last tab, select the first one
                    nextTabIndex = 1;
            }
            else {  //Tabbing backwards
                if (currentTabIndex == 1) // At the first tab, go to the last
                    nextTabIndex = n_tabs;
                else
                    nextTabIndex = currentTabIndex - 1;
            }
            //select_tab( $(tabList).children(':nth-child('+nextTabIndex')') );
            select_tab( $(tabList).children(':nth-child('+nextTabIndex+')')[0] );
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
        if( view.unconnectedVisible == true ) {
            view.unconnectedVisible = false;
            $('#svgTop').text('show unconnected');
        }
        else {
            view.unconnectedVisible = true;
            $('#svgTop').text('hide unconnected');
        }
        filter_view();
    });

    $('.status.left').on('click', function(e) {
        console.log('a');
    });

    drawing_handlers();
}

}
