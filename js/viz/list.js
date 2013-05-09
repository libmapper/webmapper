var svgns = 'http://www.w3.org/2000/svg';

tabList = null;
tabDevices = null;
selectedTab = null;
leftTable = null;
rightTable = null;
svgArea = null;
selectLists = {};
actionDiv = null;
devActions = null;
sigActions = null;
arrows = [];
menuList = null;
menuSave = null;
websocketStatus = null;

/* OLD
function listTable(parent, id)
{
    var self = this;
    this.id = id;
    this.parent = parent;
    this.rowsel = [];
    this.table;

    this.add = function() {
        $(this.parent).append("<div class='tableDiv' id='"+this.id+"'></div>");
        $("#"+this.id).append(
            "<table class='displayTable'>"+
                "<thead><tr></tr></thead>"+
                "<tbody></tbody>"+
            "<div class='status'></div>"
        );
        this.table = $("#"+this.id+" .displayTable")[0];
        add_header();
    }

    function add_header() {

        for (var i = 0; i < 4; i++) {
            $('#'+self.id+' thead tr').append('<th></th>');
        }
        // TODO move these handlers to a handler function

        //$(self.table).tablesorter({widgets: ['zebra']});
    }
}*/

//An object for the left and right tables, listing devices and signals
function listTable(id)
{ 
    this.id = id; //Something like "leftTable"
    this.parent; //The node containing the table
    this.div; //The div node (and status)
    this.table; //The table node itself
    this.headerRow; //The top row node of the table within <thead>
    this.body; //The <tbody> node

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
            "</table>"+
            "<div class='status'></div>"
        );
        this.table = $(this.div).children('.displayTable')[0];
        this.headerRow = $("#"+this.id+" .displayTable thead tr")[0];
        this.body = $("#"+this.id+" .displayTable tbody")[0];
        //$(this.table).tablesorter({widgets: ['zebra']});
    }

    // e.g. headerStrings = ["Name", "Units", "Min", "Max"]
    this.set_headers = function(headerStrings)
    {
        $(this.headerRow).empty();
        for(var i in headerStrings)
        {
            $(this.headerRow).append("<th>"+headerStrings[i]+"</th>");
        }
    }

    // For when something changes on the network
    this.update = function()
    {
        $(this.body).empty();
        for(var i in trs){
            this.$body.append("<tr>"+trs[i]+"</tr>");
        }
    }

}

function update_display()
{
    update_tabs();
    if (selectedTab == all_devices)
        update_devices();
    else
        update_signals(selectedTab);

    update_selection();
    update_arrows();
    //TODO make this work
    //update_save_location();
    search_filter( $('#leftSearch') );
    search_filter( $('#rightSearch') );
}

function update_devices()
{
    var keys = devices.keys();
    var sigkeys = signals.keys();
    var updaterLeft = new table_updater(leftTable.table);
    var updaterRight = new table_updater(rightTable.table);

    updaterLeft.setHeaders();
    updaterRight.setHeaders();
    
    for (var d in keys) {
        var k = keys[d];
        var dev = devices.get(k);

        if (dev.n_outputs)
            updaterLeft.addrow([dev.name, dev.n_outputs, dev.host, dev.port]);
        if (dev.n_inputs)
            updaterRight.addrow([dev.name, dev.n_inputs, dev.host, dev.port]);
    }

    updaterLeft.updateStatusBar('devices');
    updaterRight.updateStatusBar('devices');

    updaterLeft.apply();
    updaterRight.apply();
}

/* Update a table with the rows and columns contained in text, add
 * rows one at a time and then apply. */
function table_updater(tab)
{
    var trs = [];
    this.$table = $(tab);
    this.$footer = $(tab).siblings('.status');
    //this.$filter = $('.leftSearch')[0].value;
    var tableBody = this.$table.children('tbody')[0];
    $(tableBody).append("<tr></tr>");

    this.addrow = function(row) {
        var tr = document.createElement('tr');
        //$(tr).addClass('odd');  // Because tablesorter's zebra widget does not work when there is only 1 row
        /*$(tr).on({
            mousedown: function(e) {
                select_tr(this);
            },
            click: function(e) {
                e.stopPropagation();
            }
        });*/
        //tr.onclick = function(y) { return function(e) { select_tr(y);
        //                                                e.stopPropagation(); }; } (tr);
        for (col in row) {
            var td = document.createElement('td');
            // The cell's corresponding header
            var tdHeader = this.$table.find('th')[col];
            $(td).addClass( $(tdHeader).text() );

            td.textContent = row[col];
            tr.appendChild(td);
        }
        trs.push(tr);
        
    }
    this.apply = function() {
        //Add a child under the 'body' of the table
        var tr = tableBody.firstChild;
        var i = 0;
        while (tr && i < trs.length) {
            tableBody.insertBefore(trs[i], tr);
            i++;
            var t = tr;
            tr = tr.nextSibling;
            tableBody.removeChild(t);
        }
        while (i < trs.length)
            tableBody.appendChild(trs[i++]);
        while (tr) {
            var t = tr;
            tr = tr.nextSibling;
            tableBody.removeChild(t);
        }
        this.$table.trigger('update'); //Update tablesorter with new data
    }

    this.setHeaders = function() {
        //Set the text of the table headers
        //Check to see if we are signals or devices
        if(selectedTab == all_devices) {
            var columnHeaders = ['device', 'outputs', 'IP', 'port']; //TODO change to reflect actual values
            if(this.$table.hasClass('rightTable')) { columnHeaders[1] = 'inputs'; }
        }
        else {
            var columnHeaders = ['name', 'type', 'length', 'units']; //TODO change to reflect actual values
        }
        var ths = $('th', $(tableBody).parent('table') );
        //var ths = this.$table.find('th');
        for(var i in ths){
            ths[i].textContent = columnHeaders[i];
        }
    }

    this.updateStatusBar = function(name) {
        //set the text of the bars at the bottom of each table
        var total = trs.length;
        this.$footer.text(
            trs.length + " of " +total+ " " +name
        );
    }
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

function update_signals()
{
    keys = signals.keys();
    var updaterLeft = new table_updater(leftTable.table);
    var updaterRight = new table_updater(rightTable.table);

    updaterLeft.setHeaders();
    updaterRight.setHeaders();
    
    for (var s in keys) {
        var k = keys[s];
        var sig = signals.get(k);
        var lnk = links.get(selectedTab+'>'+sig.device_name);

        if (sig.device_name == selectedTab && sig.direction == 1)
            updaterLeft.addrow([sig.device_name+sig.name, sig.type, sig.length, sig.unit]);
        if (sig.direction == 0 && lnk!=null)
            updaterRight.addrow([sig.device_name+sig.name, sig.type, sig.length, sig.unit]);
    }

    updaterLeft.updateStatusBar('signals');
    updaterRight.updateStatusBar('signals');

    updaterLeft.apply();
    updaterRight.apply();
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

    $('.svgDiv').children('.status').text(
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

    $('.svgDiv').children('.status').text(
        n_visibleConnections + " of " + n_connections + " connections"
    );
}

//A function to filter tables by text in boxes
function search_filter($searchBox)
{
    var filterText = $searchBox.val();

    //Is it the left box
    if( $searchBox.attr('id').search('left') == 0 ) {
        var $tableBody = $(leftTable.table).children('tbody');
    }
    else var $tableBody = $(rightTable.table).children('tbody');

    var $trs = $tableBody.children('tr');
    var n_total = $trs.length;
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
                if( n_visible % 2 == 0 ) {
                    // for getting the zebra stripe effect
                    $(row).addClass('even');
                }
                else {
                    $(row).removeClass('even');
                }
            }
            else {
                $(row).hide();   
            }
        }
    });

    //Make sure the status display at the bottom has the proper numbers
    update_status_bar($tableBody, n_visible, n_total);
    update_arrows();
}

function update_status_bar($tableBody, n_visible, n_total)
{
    //Find the appropriate status bar
    var $status = $tableBody.parents('.tableDiv').children('.status');

    var name; //Devices or signals
    if( selectedTab == all_devices ) {
        name = "devices";
    }
    else name = "signals";

    $status.text(n_visible + " of " + n_total + " " + name);
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
    }
    else {
        //set_actions(sigActions);
        $('#svgTitle').text("Connections");
    }

    $('#leftSearch, #rightSearch').val('');
    command.send('tab', selectedTab);
    position_dynamic_elements();
    update_display();
}

function select_tr(tr)
{
    var t = $(tr);
    var name = tr.firstChild.innerHTML;

    //tr.parentNode = <body>, <body>.parentNode = <table>
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
    update_arrows();
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
        if( ! $(arrows[i].leftTr).hasClass('trsel') )
            select_tr(arrows[i].leftTr);
        if( ! $(arrows[i].rightTr).hasClass('trsel') )
            select_tr(arrows[i].rightTr);
    }
}

function update_connection_properties()
{
    if (selectedTab == all_devices)
        return;

    //var a = function(x) { return $(x,actionDiv); };

    var clear_props = function() {
        $(".mode").removeClass("modesel");
        $("*").removeClass('waiting');
        $(".topMenu input").val('')
        //set_boundary(a(".boundary"), 0);
    }

    var conns = get_selected(connections);
    if (conns.length > 1) {
        // TODO
        clear_props();
    }
    else if (conns.length == 1) {
        var c = conns[0];
        clear_props();
        $(".mode"+connectionModes[c.mode]).addClass("modesel");
        $(".expression").val(c.expression);
        if (c.range[0]!=null) { $("#rangeSrcMin").val(c.range[0]); }
        if (c.range[1]!=null) { $("#rangeSrcMax").val(c.range[1]); }
        if (c.range[2]!=null) { $("#rangeDestMin").val(c.range[2]); }
        if (c.range[3]!=null) { $("#rangeDestMax").val(c.range[3]); }
        if (c.bound_min!=null) { set_boundary($("#boundaryMin"),c.clip_min,0);};
        if (c.bound_max!=null) { set_boundary($("#boundaryMax"),c.clip_max,1);};
    }
    else {
        clear_props();
    }
}

function update_connection_properties_for(conn, conns)
{
    if (conns.length == 1) {
        if (conns[0].src_name == conn.src_name
            && conns[0].dest_name == conn.dest_name)
        {
            update_connection_properties();
        }
    }
}

function get_selected(list)
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

function set_boundary(boundaryElement, value, ismax)
{
    for (i in boundaryIcons)
        boundaryElement.removeClass(boundaryIcons[i]);

    if (value == 3) { //'Fold' special case, icon depends on direction
        if (ismax)
            boundaryElement.addClass('boundaryDown');
        else
            boundaryElement.addClass('boundaryUp');
    }
    else if (value < 5) {
        boundaryElement.addClass('boundary'+boundaryModes[value]);
    }
}

function copy_selected_connection()
{
    var conns = get_selected(connections);
    if (conns.length!=1) return;
    var args = {};

    // copy existing connection properties
    for (var c in conns[0]) {
        args[c] = conns[0][c];
    }
    return args;
}

function selected_connection_set_mode(modestring)
{
    var modecmd = connectionModeCommands[modestring];
    if (!modecmd) return;

    var args = copy_selected_connection();

    // adjust the mode
    args['mode'] = modecmd;

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);
}

function selected_connection_set_input(what,field,idx)
{
    var args = copy_selected_connection();

    // TODO: this is a bit out of hand, need to simplify the mode
    // strings and indexes.
    var modecmd = connectionModeCommands[connectionModes[args['mode']]];
    args['mode'] = modecmd;

    // adjust the field
    if (idx===undefined)
        args[what] = field.value;
    else
        args[what][idx] = parseFloat(field.value);

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);

    $(field).addClass('waiting');
}

function selected_connection_set_boundary(boundarymode, ismax, div)
{
    var args = copy_selected_connection();

    // TODO: this is a bit out of hand, need to simplify the mode
    // strings and indexes.
    var modecmd = connectionModeCommands[connectionModes[args['mode']]];
    args['mode'] = modecmd;

    var c = ismax ? 'clip_max' : 'clip_min';
    args[c] = boundarymode;

    // send the command, should receive a /connection/modify message after.
    command.send('set_connection', args);

    // Do not set the background color, since background is used to
    // display icon.  Enable this if a better style decision is made.
    //$(div).addClass('waiting');
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

function on_boundary(e)
{
    for (var i in boundaryIcons) {
        if ($(e.currentTarget).hasClass(boundaryIcons[i]))
            break;
    }
    if (i >= boundaryIcons.length)
        return;

    var b = [0, 3, 3, 1, 2, 4][i];
    b = b + 1;
    if (b >= boundaryModes.length)
        b = 0;

    // Enable this to set the icon immediately. Currently disabled
    // since the 'waiting' style is not used to indicate tentative
    // settings for boundary modes.

    // set_boundary($(e.currentTarget), b,
    //              e.currentTarget.id=='boundaryMax');

    selected_connection_set_boundary(b, e.currentTarget.id=='boundaryMax',
                                     e.currentTarget);

    e.stopPropagation();
}


function set_actions(a)
{
    $(actionDiv).empty();
    actionDiv.appendChild(a);
}

function position_dynamic_elements()
{
    var hT = fullOffset($("#spacerTable")[0]);

    $('.svgDiv, .tableDiv').css({
        'height': (document.body.clientHeight - hT.top - 10) + "px",
        'top': (hT.top) + 'px'
    });

    // Allow tables to collapse the columns naturally, and then we'll
    // expand to fill the space if necessary.
    $('.displayTable').css('width','100%');

    // Need to run this twice, since movement of the table causes
    // appearance or disappearance of scroll bars, which changes the
    // layout.
    var update_tables = function() {
        var h = $("#spacerTable").find("tr").find("td").map(
            function(){return fullOffset(this);});

        $('#leftTable.tableDiv').css({
            'left': h[0].left+"px",
            'width': h[0].width+'px'
        });

        $('.svgDiv').css({
            'left': h[1].left+'px',
            'width': h[1].width+'px'
        });

        $('#rightTable.tableDiv').css({
            'left': h[2].left+"px",
            'width': h[2].width+'px'
        });
        /*
        svgDiv.offsetWidth =
        //svgArea.offsetWidth = 
        h[1].width;

        //What are these for?
        if (parseInt(leftTable.offsetWidth) < h[0].width) {
            leftTable.style.width = h[0].width + "px";
        }

        if (parseInt(rightTable.offsetWidth) < h[2].width) {
            rightTable.style.width = h[2].width + "px";
        }
        */

        //Position titles and search bars
        $('#leftTitle').css("left", h[0].left+10+"px");
        $('#leftSearch').css("left", h[1].left-124+"px");
        $('#svgTitle').width( $(window).width() );
        $('#rightTitle').css("left", h[2].left+10+"px");
        $('#rightSearch').css("right", "20px");

        //Make sure status bars are proper width
    }
    update_tables();
    update_tables();


}

function notify(msg)
{
    var li = document.createElement('li');
    li.className = 'notification';
    li.innerHTML = msg;
    menuList.appendChild(li);
    setTimeout(function(){
        $(li).fadeOut('slow', function(){menuList.removeChild(li);});
    }, 5000);
}

function on_load()
{
    var body = document.getElementsByTagName('body')[0];
    var iframe = document.createElement('iframe');
    iframe.name = 'file_upload';
    iframe.style.visibility = 'hidden';
    body.appendChild(iframe);

    var form = document.createElement('form');
    form.innerHTML = '<input id="file" type="file"                   \
                       name="mapping_json" size="40" accept="json">  \
                      <input type="submit" style="display: none;">   \
                      <input type="button" value="Cancel" id="cancel">';
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = '/load';
    form.target = 'file_upload';

    var l = document.createElement('li');
    l.appendChild(form);
    menuList.appendChild(l);

    iframe.onload = function(){
        var t = $(iframe.contentDocument.body).text();
        if (t.search('Success:')==-1 && t.search('Error:')==-1)
            return;
        notify($(iframe.contentDocument.body).text());
        menuList.removeChild(l);
        body.removeChild(iframe);
    };

    $('#cancel',form).click(function(){
        menuList.removeChild(l);
        body.removeChild(iframe);
    });

    form.firstChild.onchange = function(){
        var fn = document.createElement('input');
        fn.type = 'hidden';
        fn.name = 'filename';
        fn.value = form.firstChild.value;
        console.log(form.firstChild.value);
        form.appendChild(fn);
        form.submit();
    };
    return false;
}

function update_save_location()
{
    if (selectedTab==all_devices) {
        menuSave.href = '';
        $(menuSave).addClass('disabled');
        menuSave.onclick=function(){return false;};
    }
    else {
        menuSave.href = '/save?dev='+encodeURIComponent(selectedTab);
        $(menuSave).removeClass('disabled');
        menuSave.onclick=null;
    }
}

function list_view_start()
{
    add_tabs();
    add_title_bar();
    add_display_tables();
    add_svg_area();
    add_UI_handlers();
    //select_tab(tabDevices);
    //add_signal_control_bar();
    //position_dynamic_elements();
    
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

    //TODO (UI) move these to the end
    $('#allDevices').on('click', function(e) {
        select_tab(tabDevices);
        e.stopPropagation();
    });

    selectedTab = all_devices;

    /*
    var body = document.getElementsByTagName('body')[0];
    tabList = document.createElement('ul');
    tabList.className = "topTabs";
    tabDevices = document.createElement('li');
    tabDevices.innerHTML = all_devices;
    tabDevices.className = "tabsel";
    tabDevices.id = "allDevices";
    tabDevices.onclick = function(e) { select_tab(tabDevices);
                                       e.stopPropagation(); };
    tabList.appendChild(tabDevices);
    body.insertBefore(tabList, body.firstChild);
    selectedTab = all_devices;
    */
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

    //TODO (UI) move these to the end
    $('#leftSearch, #rightSearch').on('keyup', function(e) {
        e.stopPropagation();
        search_filter( $(this) );
    });
}

function add_display_tables()
{
    //Make the spacer table, how the elements locate themselves on the page
    $('#container').append(
        "<table id='spacerTable'><tr><td></td><td></td><td></td></tr></table>"
    );

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
            "<div id='svgTop'></div>"+
            "<div class='status'></div>"+
        "</div>"
    );

    svgArea = Raphael( $('.svgDiv')[0], '100%', '100%');
    
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
        command.register("new_link", function() {
            self.line.remove();
        });
        command.register("new_connection", function() {
            self.line.remove();
        });
        if( !this.targetRow ) {
            this.line.remove();
        }
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
    
    $(targetTable).find('tbody tr').each( function(index, element) {
        var targetLength =  $(element).children('.length').text();
        if( sourceLength != targetLength ) 
            $(element).addClass('incompatible');
    }); 
}

function add_UI_handlers()
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
    });

    drawing_handlers();
}
