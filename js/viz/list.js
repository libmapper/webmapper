//An object for the overall display
function listView()
{

var svgns = 'http://www.w3.org/2000/svg';

tabList = null;
tabDevices = null;
selectedTab = null;
leftTable = null;
rightTable = null;
svgArea = null;
selectLists = {};
devActions = null;
sigActions = null;
arrows = [];

sourceDeviceHeaders = ["device", "outputs", "IP", "port"];
destinationDeviceHeaders = ["device", "inputs", "IP", "port"];
//TODO include min/max
signalHeaders = ["name", "type", "length", "units", "min", "max"];

    this.type = 'list';
    this.unconnectedVisible = true // Are unconnected devices/signals visible?

    this.init = function() {
        add_tabs();
        add_title_bar();
        add_display_tables();
        add_svg_area();
        add_status_bar();
        this.add_handlers();
        select_tab(tabDevices);
        this.update_display();
    }

    this.update_display = function() {
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
        update_arrows();

        search_filter( $('#leftSearch') );
        search_filter( $('#rightSearch') );
    }

    this.get_selected = function(list)
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

    this.on_resize = function() 
    {
        update_arrows();
    }

//An object for the left and right tables, listing devices and signals
function listTable(id)
{ 
    this.id = id; //Something like "leftTable"
    this.parent; //The node containing the table
    this.div; //The div node (and status)
    this.table; //The table node itself
    this.headerRow; //The top row node of the table within <thead>
    this.tBody; //The <tbody> node
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
        this.tBody = $("#"+this.id+" .displayTable tbody")[0];

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
    // big TODO (make the tableupdater object obsolete)
    this.update = function(tableData, headerStrings)
    {
        $(this.tBody).empty();
        for(var row in tableData) 
        {
            //If there is only one row, make it of odd class for styling
            var newRow = "<tr class='odd'>"
            for(var col in tableData[row]) {
                newRow += "<td class="+headerStrings[col]+">"+tableData[row][col]+"</td>";
            }
            $(this.tBody).append(newRow+"</tr>");
        }
        this.nRows = tableData.length;
        if(tableData[0])
            this.nCols = tableData[0].length;
        $(this.table).trigger('update');
        // Just incase a device is added while search filter is occuring
        search_filter( $('#leftSearch') );
        search_filter( $('#rightSearch') );
    }

    this.set_status = function() {
        var name; //Devices or signals
        if( selectedTab == all_devices ) {
            name = "devices";
        }
        else name = "signals";
        $(this.footer).text(this.nVisibleRows+" of "+this.nRows+" "+name);
    }

}

function update_devices()
{
    var keys = devices.keys();

    var leftBodyContent = [];
    var rightBodyContent = [];

    leftTable.set_headers(sourceDeviceHeaders);
    rightTable.set_headers(destinationDeviceHeaders);    
    
    for (var d in keys) {
        var k = keys[d];
        var dev = devices.get(k);

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
    var keys = signals.keys();
    
    var leftBodyContent = [];
    var rightBodyContent = [];
    
    for (var s in keys) {
        var k = keys[s];
        var sig = signals.get(k);
        var lnk = links.get(selectedTab+'>'+sig.device_name);

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
    var keys = links.keys();
    var srcs = {};
    for (var l in keys)
        srcs[links.get(keys[l]).src_name] = null;
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
    l = selectLists[selectedTab];
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
    for (a in arrows) {
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

    var keys = links.keys();
    for (var k in keys) {
        var l = links.get(keys[k]);
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
                            create_arrow(left, right, leftsel && rightsel);
                            n_visibleLinks++;
                        }
                    });
            });
    }

    $('.status.middle').text(
        n_visibleLinks + " of " + links.keys().length + " links"
    );

}

function update_arrows()
{
    if (selectedTab == all_devices)
        update_links();
    else
        update_connections();
}

function update_connections()
{
    cleanup_arrows();
    var n_connections = 0;
    var n_visibleConnections = 0;

    var keys = connections.keys();
    for (var k in keys) {
        var c = connections.get(keys[k]);
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
                            create_arrow(left, right, leftsel && rightsel);
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

//A function to filter tables by text in boxes
function search_filter($searchBox)
{
    var filterText = $searchBox.val();

    //Is it the left box
    if( $searchBox.attr('id').search('left') == 0 ) {
        var targetTable = leftTable;
    }
    else var targetTable = rightTable;

    var $trs = $(targetTable.tBody).children('tr');
    var n_total = targetTable.nRows;
    var n_visible = 0;

    $trs.each( function(i, row) {
        var cells = $(row).find('td');
        if(cells.length > 0)
        {
            var found = false;
            cells.each( function(j, td) 
            {
                var regExp = new RegExp(filterText, 'i');
                if(regExp.test( $(td).text() ))
                {
                    found = true;
                    return false;
                }
            });
            if(found == true) {
                $(row).show();
                n_visible++;
            }
            else {
                $(row).hide();   
            }
        }
    });

    targetTable.nVisibleRows = n_visible;

    //Make sure the status display at the bottom has the proper numbers
    targetTable.set_status();
    $(targetTable.table).trigger('update');
    //update_status_bar($(targetTable.tBody), n_visible, n_total);
    update_arrows();
}

/* params are TR elements, one from each table */
function create_arrow(left, right, sel)
{
    var line = svgArea.path();
    if (sel)
        line.attr({"stroke": "red"});
    else
        line.attr({"stroke": "black"});
    line.attr({
        "fill": "none",
        "stroke-width": 2,
        "cursor": "pointer"
    });

    
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
            line.attr('stroke', 'red');
        }
        e.stopPropagation();
    });
}

function select_tab(tab)
{
    selectedTab = tab.innerHTML;
    $(".tabsel").removeClass("tabsel");
    $(tab).addClass("tabsel");

    if (tab == tabDevices) {
        //set_actions(devActions);
        $('#svgTitle').text("Links");
        leftTable.set_headers(sourceDeviceHeaders);
        rightTable.set_headers(destinationDeviceHeaders);
        $('.signalControlsDiv').addClass('disabled');
    }
    else {
        //set_actions(sigActions);
        $('#svgTitle').text("Connections");
        leftTable.set_headers(signalHeaders);
        rightTable.set_headers(signalHeaders);
        $('.signalControlsDiv').removeClass('disabled');
    }

    $('#leftSearch, #rightSearch').val('');
    command.send('tab', selectedTab);
    view.update_display();
}

function select_tr(tr)
{
    var t = $(tr);
    var name = tr.firstChild.innerHTML;

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

    selectLists[selectedTab][i] = l;
    //TODO find out if this is actually necessary
    // Yes it is, makes the arrows red, which seems like a lot of computation
    // For just that effect, I'll explicitly make them red for now
    //update_arrows();
    update_connection_properties();
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
    // Do the same thing for the row height
    var heightInPx = $(sourceRow).css('height');
    this.rowHeight = +heightInPx.substring(0, heightInPx.length - 2);

    //
    this.clamptorow = function( row ) {
        var y = ( $(row).index() + 1.5 ) * this.rowHeight;
        return y;
    }

    this.findrow = function ( y ) {
        var index = Math.round( y/this.rowHeight );
        if( index > $(this.targetTable).find('tr').length)
            index = $(this.targetTable).find('tr').length;
        var row = $(this.targetTable).find('tr')[index - 1];
        var incompatible = $(row).hasClass('incompatible');
        if( !incompatible )
            return row;
    }

    // Our bezier curve points
    this.path = [ ["M"], ["C"]];

    // Are we aiming for the left or right table?
    this.targetTable;
    if( $(this.sourceRow).parents('.tableDiv').attr('id') == "leftTable" ) {
        this.targetTable = $('#rightTable .displayTable tbody')[0];
        this.path[0][1] = 0; // Start the curve at left
    }
    else {
        this.targetTable = $('#leftTable .displayTable tbody')[0];
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
            this.checkTarget(null);
            end = [ moveEvent.offsetX, moveEvent.offsetY ];
            // Within clamping range
            if( this.canvasWidth - Math.abs(end[0] - start[0]) < 50) {
                end[0] = this.canvasWidth - start[0];
                var clampRow = this.findrow(end[1]);
                if(clampRow) {
                    c1 = end[1];
                    end[1] = this.clamptorow(clampRow);
                    this.checkTarget(clampRow);
                }
            }
        }
        // We're over a table row of the target table
        if( $(target).parents('tbody')[0] == this.targetTable ) {
            this.checkTarget(target);
            end[0] = this.canvasWidth - start[0];
            if( !$(target).hasClass('incompatible') ) 
                end[1] = this.clamptorow(target);
            c1 = end[1] + moveEvent.offsetY - this.rowHeight/2;

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
        if(this.targetRow != mousedOverRow) {
            this.targetRow = mousedOverRow
            deselect_all();
            select_tr(this.sourceRow);
            if(this.targetRow && !$(this.targetRow).hasClass('incompatible') )
                select_tr(this.targetRow);
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

            // Fade out incompatible signals
            if( selectedTab != all_devices )
                fade_incompatible_signals(curve.sourceRow, curve.targetTable);

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

function fade_incompatible_signals(row, targetTable)
{
    var sourceLength = $(row).children('.length').text();
    
    $(targetTable).children('tr').each( function(index, element) {
        var targetLength =  $(element).children('.length').text();
        if( sourceLength != targetLength ) 
            $(element).addClass('incompatible');
    }); 
}

// A function to hide/show unconnected devices/signals
function toggle_unconnected()
{
    if ( view.unconnectedVisible == true ) {
        $('.displayTable tbody tr').hide();
        for (var i in arrows) {
            $(arrows[i].leftTr).show();
            $(arrows[i].rightTr).show();
        }
        view.unconnectedVisible = false;
        $('#svgTop').text('show unconnected');
    }
    else {
        $('.displayTable tbody tr').show();
        view.unconnectedVisible = true;
        $('#svgTop').text('hide unconnected');
    }
    $(rightTable.table).trigger('update');
    $(leftTable.table).trigger('update');
    update_arrows();
    //search_filter( $('#leftSearch') );
    //search_filter( $('#rightSearch') );
}

this.add_handlers = function()
{
    $('body').on('click', function() {
        deselect_all();
    });

    $('.displayTable tbody').on({
        mousedown: function(e) { select_tr(this); },
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
    $(document).keydown( function(e) {
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
        else if (e.which == 9 && e.altKey == true) { // Tabbing like in google chrome 'ctrl-tab'
            e.preventDefault();
            var n_tabs = $(tabList).children().length;
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
        search_filter( $(this) );
    });

    $('.tableDiv').on('scroll', function(e) {
        update_arrows();
    });

    $('#svgTop').on('click', function(e) {
        e.stopPropagation();
        toggle_unconnected();
    })

    drawing_handlers();
}

}
