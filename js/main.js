
var svgns = 'http://www.w3.org/2000/svg';

devices = new Assoc();
signals = new Assoc();
links = new Assoc();
connections = new Assoc();
var drawLine;

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

all_devices = 'All Devices';

connectionModes = ["None", "Byp", "Line", "Expr", "Calib"];
connectionModesDisplayOrder = ["Byp", "Line", "Calib", "Expr"];
connectionModeCommands = {"Byp": 'bypass',
                          "Line": 'linear',
                          "Calib": 'calibrate',
                          "Expr": 'expression'};
boundaryModes = ["None", "Mute", "Clamp", "Fold", "Wrap"];
boundaryIcons = ["boundaryNone", "boundaryUp", "boundaryDown",
                 "boundaryMute", "boundaryClamp", "boundaryWrap"];

function update_display()
{
    update_tabs();
    if (selectedTab == all_devices)
        update_devices();
    else
        update_signals(selectedTab);

    update_selection();
    update_arrows();
    update_save_location();
    search_filter( $('#leftSearch') );
    search_filter( $('#rightSearch') );
}

function update_devices()
{
    var keys = devices.keys();
    var sigkeys = signals.keys();
    var updaterLeft = new table_updater(leftTable);
    var updaterRight = new table_updater(rightTable);
    
    for (var d in keys) {
        var k = keys[d];
        var dev = devices.get(k);

        if (dev.n_outputs)
            updaterLeft.addrow([dev.name, dev.n_outputs, dev.host, dev.port]);
        if (dev.n_inputs)
            updaterRight.addrow([dev.name, dev.n_inputs, dev.host, dev.port]);
    }

    updaterLeft.setHeaders();
    updaterRight.setHeaders();

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
    tableBody.appendChild(document.createElement('tr'));

    this.addrow = function(row) {
        var tr = document.createElement('tr');
        $(tr).on({
            mousedown: function(e) {
                select_tr(this);
            },
            click: function(e) {
                e.stopPropagation();
            }
        });
        //tr.onclick = function(y) { return function(e) { select_tr(y);
        //                                                e.stopPropagation(); }; } (tr);
        for (col in row) {
            var td = document.createElement('td');
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
    var updaterLeft = new table_updater(leftTable);
    var updaterRight = new table_updater(rightTable);
    
    for (var s in keys) {
        var k = keys[s];
        var sig = signals.get(k);
        var lnk = links.get(selectedTab+'>'+sig.device_name);

        if (sig.device_name == selectedTab && sig.direction == 1)
            updaterLeft.addrow([sig.device_name+sig.name, sig.type, sig.length, sig.unit]);
        if (sig.direction == 0 && lnk!=null)
            updaterRight.addrow([sig.device_name+sig.name, sig.type, sig.length, sig.unit]);
    }

    updaterLeft.setHeaders();
    updaterRight.setHeaders();

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

    checksel(leftTable, 0);
    checksel(rightTable, 1);
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
        $('td:endswith('+l.src_name+')', leftTable).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:endswith('+l.dest_name+')', rightTable).each(
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
        $('td:endswith('+c.src_name+')', leftTable).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:endswith('+c.dest_name+')', rightTable).each(
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
        var $tableBody = $(leftTable).children('tbody');
    }
    else var $tableBody = $(rightTable).children('tbody');

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

    line.border.click(function(e) {
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
    var i = (t.parents('.displayTable')[0] == leftTable) ? 0 : (t.parents('.displayTable')[0] == rightTable) ? 1 : null;
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
    $('tr.trsel', leftTable).each(function(i,e){
            selectLists[selectedTab][0].remove(e.firstChild.innerHTML);
            $(this).removeClass('trsel');
        });
    $('tr.trsel', rightTable).each(function(i,e){
            selectLists[selectedTab][1].remove(e.firstChild.innerHTML);
            $(this).removeClass('trsel');
        });
    update_arrows();
    update_connection_properties();
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
        if (c.clip_min!=null) { set_boundary($("#boundaryMin"),c.clip_min,0);};
        if (c.clip_max!=null) { set_boundary($("#boundaryMax"),c.clip_max,1);};
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
    var L = $('.trsel', leftTable);
    var R = $('.trsel', rightTable);
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
    $('tr.trsel', leftTable).each(
        function(i,e){
            var left = e;
            $('tr.trsel', rightTable).each(
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
    $('.displayTable').css('width','auto');

    // Need to run this twice, since movement of the table causes
    // appearance or disappearance of scroll bars, which changes the
    // layout.
    var update_tables = function() {
        var h = $("#spacerTable").find("tr").find("td").map(
            function(){return fullOffset(this);});

        $('.leftTable.tableDiv, .leftTable.displayTable').css({
            'left': h[0].left+"px",
            'width': h[0].width+'px'
        });

        $('.svgDiv').css({
            'left': h[1].left+'px',
            'width': h[1].width+'px'
        });

        $('.rightTable.tableDiv, .rightTable.displayTable').css({
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

/* The main program. */
function main()
{
    command.register("all_devices", function(cmd, args) {
        for (d in args)
            devices.add(args[d].name, args[d]);
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        devices.add(args.name, args);
        update_display();
    });
    command.register("del_device", function(cmd, args) {
        devices.remove(args.name);
        if (selectedTab==args.name)
            select_tab(tabDevices);
        else
            update_display();
    });

    command.register("all_signals", function(cmd, args) {
        for (d in args)
            signals.add(args[d].device_name+args[d].name
                        +'/_dir_'+args[d].direction,
                        args[d]);
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        signals.add(args.device_name+args.name
                    +'/_dir_'+args.direction, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        signals.remove(args.device_name+args.name
                       +'/_dir_'+args.direction);
        update_display();
    });

    command.register("all_links", function(cmd, args) {
        for (l in args)
            links.add(args[l].src_name+'>'+args[l].dest_name,
                      args[l]);
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        links.add(args.src_name+'>'+args.dest_name, args);
        update_display();
    });
    command.register("del_link", function(cmd, args) {
        links.remove(args.src_name+'>'+args.dest_name);
        update_display();
    });

    command.register("all_connections", function(cmd, args) {
        for (d in args)
            connections.add(args[d].src_name+'>'+args[d].dest_name,
                            args[d]);
        update_display();
        for (d in args)
            update_connection_properties_for(args[d],
                                             get_selected(connections));
    });
    command.register("new_connection", function(cmd, args) {
        connections.add(args.src_name+'>'+args.dest_name, args);
        update_display();
        update_connection_properties_for(args, get_selected(connections));
    });
    command.register("mod_connection", function(cmd, args) {
        connections.add(args.src_name+'>'+args.dest_name, args);
        update_display();
        update_connection_properties_for(args, get_selected(connections));
    });
    command.register("del_connection", function(cmd, args) {
        var conns = get_selected(connections);
        connections.remove(args.src_name+'>'+args.dest_name);
        update_display();
        update_connection_properties_for(args, conns);
    });

    var body = document.getElementsByTagName('body')[0];
    //body.onclick = deselect_all;

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            add_display_tables();
            add_svg_area();
            add_action_div();
            add_title_bar();
            add_tabs();
            add_menu();
            add_extra_tools();
            add_UI_handlers();
            command.start();
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
            select_tab(tabDevices);
            add_signal_control_bar();
            position_dynamic_elements();
            window.onresize = function (e) {
                position_dynamic_elements();
                update_arrows();
            };
        },
        100);
}



function add_display_tables()
{
    var body = document.getElementsByTagName('body')[0];
    var make = function(cls) {
        var d = document.createElement('div');
        d.className = "tableDiv "+cls;
        d.onscroll = on_table_scroll;
        var t = document.createElement('table');
        t.border = 1;
        t.className = "displayTable "+cls;
        t.appendChild(document.createElement('thead'));
        b = document.createElement('tbody');
        t.appendChild(document.createElement('tbody'));
        add_table_header(t);
        d.appendChild(t);
        add_status_footer(d);
        body.insertBefore(d, body.firstChild);
        $(t).tablesorter({widgets: ['zebra']});
        return t;
    }

    leftTable = make('leftTable');
    rightTable = make('rightTable');
}

//Add the header rows to the table
function add_table_header(tab)
{
    var header = tab.firstChild;
    var headtr = document.createElement('tr');
    header.appendChild(headtr);
    //var columnHeaders = ['Name', 'IP', 'Port'] //TODO change to reflect actual values
    for (var i = 0; i < 4; i ++) {
        var th = document.createElement('th');
        //th.textContent = columnHeaders[i];
        $(th).click(function(e) {
            e.stopPropagation();
            $(tab).on("sortEnd", function() {
                update_arrows();
            } );
        });
        headtr.appendChild(th);
    }
}

//add the status bar that appears at the bottom of the tables
function add_status_footer(d)
{
    var statusDiv = document.createElement('div');
    d.appendChild(statusDiv);
    statusDiv.className = "status";
    //statusDiv.setAttribute("padding", "1px")
    //statusDiv.textContent = "0 of 0 devices";
}

function add_svg_area()
{
    var body = document.getElementsByTagName('body')[0];
    var svgDiv = document.createElement('div');
    $(svgDiv).addClass('svgDiv');
    $(svgDiv).css({
        'position': 'absolute',
        'background-color': 'white'
    });

    $(svgDiv).append("<div id='svgTop'></div>");
    body.insertBefore(svgDiv, body.firstChild);

    $(svgDiv).css('border', "solid 1px black");
    $(svgArea).css('background', 'white');

    svgArea = Raphael(svgDiv, '100%', '100%');
    

    add_status_footer(svgDiv);
}

function refresh_all()
{
    devices = new Assoc();
    signals = new Assoc();
    links = new Assoc();
    connections = new Assoc();
    update_display();
    command.send('refresh');
}

function add_tabs()
{
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
}

function add_action_div()
{
    var body = document.getElementsByTagName('body')[0];
    actionDiv = document.createElement('div');
    body.insertBefore(actionDiv, body.firstChild);
    $(actionDiv).addClass("actionDiv");
}

function add_title_bar()
{

    var $titleSearchDiv = $('<div id="titleSearchDiv"></div>');

    var $leftTitle = $('<h2 id="leftTitle" class="searchBar">Sources</h2></li>');
    var $svgTitle = $('<h2 id="svgTitle" class="searchBar">Links</h2></li>');
    var $rightTitle = $('<h2 id="rightTitle" class="searchBar">Destinations</h2></li>');

    var $leftSearch = $('<input type="text" id="leftSearch" class="searchBar"></input></li>');
    var $rightSearch = $('<input type="text" id="rightSearch" class="searchBar"></input></li>');

    $svgTitle.css('text-align','center');

    $titleSearchDiv.append($leftTitle, $leftSearch, $svgTitle, $rightTitle, $rightSearch);
    $titleSearchDiv.insertAfter('.actionDiv');

    //Make sure that noting appears in front of the text inputs
    $('#titleSearchDiv input').css('z-index', '1')

    $('#leftSearch, #rightSearch').on('keyup', function(e) {
        e.stopPropagation();
        search_filter( $(this) );
    });
}

function add_signal_control_bar() //A jQuery copy of the below, more or less
{
    $('.topMenu').append("<div class='signalControlsDiv'></div>");

    //Add the mode controls
    $('.signalControlsDiv').append("<div class='modesDiv'></div>");
    for (m in connectionModesDisplayOrder) {
        $('.modesDiv').append(
            "<div class='mode mode"+connectionModesDisplayOrder[m]+"'>"+connectionModesDisplayOrder[m]+"</div>");
    }
    $('.mode').on("click", function(e) {
        e.stopPropagation();
        selected_connection_set_mode(e.currentTarget.innerHTML);
    });
    $('.modesDiv').append("<input type='text' size=25 class='expression'></input>");

    //Add the range controls
    $('.signalControlsDiv').append(
        "<div class='rangesDiv'>"+
            "<div class='range'>Source Range:</div>"+
            "<div class='range'>Dest Range:</div>"+
        "</div>");
    $('.range').append("<input><input>");
    $('.range').children('input').each( function(i) {
        var minOrMax = 'Max'   // A variable storing minimum or maximum
        var srcOrDest = 'Src'
        if(i%2==0)  minOrMax = 'Min';
        if(i>1)     srcOrDest = 'Dest';
        $(this).attr({
            'maxLength': 15,
            "size": 5,
            // Previously this was stored as 'rangeMin' or 'rangeMax'
            'class': 'range',   
            'id': 'range'+srcOrDest+minOrMax,
            'index': i
        })
    });

    //The expression and range input handlers
    $('.topMenu').on({
        keydown: function(e) {
            e.stopPropagation();
            if(e.which == 13) //'enter' key
                selected_connection_set_input( $(this).attr('class'), this, $(this).attr('index') );
        },
        click: function(e) { e.stopPropagation(); },
        blur: function() {selected_connection_set_input( $(this).attr('class'), this, $(this).attr('index') );}
    }, 'input');
}

function add_menu()
{
    var body = document.getElementsByTagName('body')[0];
    menuList = document.createElement('ul');
    menuList.className = "topMenu";
    var menuLoadLi = document.createElement('li');
    var menuLoad = document.createElement('a');
    menuLoad.innerHTML = 'Load';
    menuLoad.href = '/';
    menuLoad.onclick = on_load;
    menuLoadLi.appendChild(menuLoad);
    menuList.appendChild(menuLoadLi);

    var menuSaveLi = document.createElement('li');
    menuSave = document.createElement('a');
    menuSave.innerHTML = 'Save';
    menuSaveLi.appendChild(menuSave);
    menuList.appendChild(menuSaveLi);

    body.insertBefore(menuList, body.firstChild);
}

function add_extra_tools()
{
    var body = document.getElementsByTagName('body')[0];
    var refresh = document.createElement('input');
    websocketStatus = document.createElement('div');
    websocketStatus.id = 'wsstatus';
    websocketStatus.innerHTML = 'websocket uninitialized';
    websocketStatus.style.bgcolor = 'white';
    websocketStatus.className = 'extratools';
    refresh.id = 'refresh';
    refresh.className = 'extratools';
    refresh.type = 'button';
    refresh.onclick = refresh_all;
    body.insertBefore(websocketStatus, body.firstChild);
    body.insertBefore(refresh, websocketStatus);
}

function add_UI_handlers()
{
    $('body').on('click', function() {
        deselect_all();
    });
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
            console.log('select all');
        }
    });

    // For drawing the bezier curves on click and drag
    // Attaches handler to each display table, but works with the table rows
    $('.displayTable').on('mousedown', 'tr', function(tableClick) {
        var row = this;
        $('svg').on({
            mouseenter: function() {
                drawLine = svgArea.path().attr({'stroke-width': 2});
                $('svg').on('mousemove', function(moveEvent) {
                    draw_bezier_path(row, moveEvent, drawLine);
                });
            },
            mouseleave: function() {
                $('svg').off('mouseenter').off('mousemove');
                drawLine.remove();
                drawLine = svgArea.path();
            }
        });
        $(document).on('mouseup', function() {
            $('svg').off('mouseenter').off('mousemove');
            if(drawLine)
                drawLine.remove();
            drawLine = svgArea.path();
        });
    });
}

function draw_bezier_path(row, end, drawLine) {

    var h = $(row).css('height'); // Returns '##px'
    h = +h.substring(0, h.length - 2); // Returns ##
    
    //Puts the initial height in the middle of the selected row
    var y0 = ( $(row).index() + 1.5 ) * h;
    var x0 = 0;
    path = [ ["M", x0, y0], ["C", x0, y0, x0, y0, x0, y0]];
    var end = [end.offsetX, end.offsetY];

    path[1][1] = path[1][3] = (end[0] + x0) / 2;
    path[1][4] = end[1];
    path[1][5] = end[0];
    path[1][6] = end[1];

    drawLine.attr({'path':path});
}

/* Kick things off. */
window.onload = main;
