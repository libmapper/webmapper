
var svgns = 'http://www.w3.org/2000/svg';

devices = new Assoc();
signals = new Assoc();
links = new Assoc();
connections = new Assoc();

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
    if (selectedTab == "All Devices")
        update_devices();
    else
        update_signals(selectedTab);

    update_selection();
    update_arrows();
}

function update_devices()
{
    keys = devices.keys();
    var updaterLeft = new table_updater(leftTable);
    var updaterRight = new table_updater(rightTable);
    for (var d in keys) {
        var k = keys[d];
        var dev = devices.get(k);

        updaterLeft.addrow([dev.name, dev.host, dev.port]);
        updaterRight.addrow([dev.name, dev.host, dev.port]);
    }
    updaterLeft.apply();
    updaterRight.apply();
}

/* Update a table with the rows and columns contained in text, add
 * rows one ata time and then apply. */
function table_updater(tab)
{
    var trs = [];
    this.addrow = function(row) {
        var tr = document.createElement('tr');
        tr.onclick = function(y) { return function(e) { select_tr(y);
                                                        e.stopPropagation(); }; } (tr);
        for (col in row) {
            var td = document.createElement('td');
            td.textContent = row[col];
            tr.appendChild(td);
        }
        trs.push(tr);
    }
    this.apply = function() {
        var tr = tab.firstChild;
        var i = 0;
        while (tr && i < trs.length) {
            tab.insertBefore(trs[i], tr);
            i++;
            var t = tr;
            tr = tr.nextSibling;
            tab.removeChild(t);
        }
        while (i < trs.length)
            tab.appendChild(trs[i++]);
        while (tr) {
            var t = tr;
            tr = tr.nextSibling;
            tab.removeChild(t);
        }
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
            updaterLeft.addrow([sig.device_name+sig.name, sig.type, sig.length]);
        if (sig.device_name != selectedTab && sig.direction == 0 && lnk!=null)
            updaterRight.addrow([sig.device_name+sig.name, sig.type, sig.length]);
    }
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
        var tr = table.firstChild;
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
        svgArea.removeChild(arrows[a].border);
        svgArea.removeChild(arrows[a]);
    }
    arrows = [];
}

function update_links()
{
    cleanup_arrows();

    var keys = links.keys();
    for (var k in keys) {
        var l = links.get(keys[k]);
        $('td:contains('+l.src_name+')', leftTable).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:contains('+l.dest_name+')', rightTable).each(
                    function(i,e){
                        var right = e.parentNode;
                        var rightsel = $(right).hasClass('trsel');
                        create_arrow(left, right, leftsel && rightsel);
                    });
            });
    }
}

function update_arrows()
{
    if (selectedTab == "All Devices")
        update_links();
    else
        update_connections();
}

function update_connections()
{
    cleanup_arrows();

    var keys = connections.keys();
    for (var k in keys) {
        var c = connections.get(keys[k]);
        $('td:contains('+c.src_name+')', leftTable).each(
            function(i,e){
                var left = e.parentNode;
                var leftsel = $(left).hasClass('trsel');
                $('td:contains('+c.dest_name+')', rightTable).each(
                    function(i,e){
                        var right = e.parentNode;
                        var rightsel = $(right).hasClass('trsel');
                        create_arrow(left, right, leftsel && rightsel);
                    });
            });
    }
}

/* params are TR elements, one from each table */
function create_arrow(left, right, sel)
{
    var line = document.createElementNS(svgns, "path");
    if (sel)
        line.setAttribute("stroke", "red");
    else
        line.setAttribute("stroke", "black");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke-width", 2);
    line.setAttribute("cursor", "pointer");

    line.border = document.createElementNS(svgns, "path");
    line.border.setAttribute("stroke", "blue");
    line.border.setAttribute("fill", "none");
    line.border.setAttribute("stroke-width", "10pt");
    line.border.setAttribute("stroke-opacity", "0");
    line.border.setAttribute("cursor", "pointer");

    var L = fullOffset(left);
    var R = fullOffset(right);
    var S = fullOffset(svgArea);

    var x1 = 0;
    var y1 = L.top+L.height/2-S.top;

    var x2 = S.width;
    var y2 = R.top+R.height/2-S.top;

    var p = "M " + x1 + " " + y1 + " C " + (x1+x2)/2 + " " + y1
        + " " + (x1+x2)/2 + " " + y2 + " " + x2 + " " + y2;
    line.setAttribute("d", p);
    line.border.setAttribute("d", p);

    svgArea.appendChild(line.border);
    svgArea.appendChild(line);
    arrows.push(line);

    var onclick = function (e) {
        select_tr(left);
        select_tr(right);
        e.stopPropagation();
    };
    line.onclick = onclick;
    line.border.onclick = onclick;
}

function select_tab(tab)
{
    selectedTab = tab.innerHTML;
    $(".tabsel").removeClass("tabsel");
    $(tab).addClass("tabsel");

    if (tab == tabDevices)
        set_actions(devActions);
    else
        set_actions(sigActions);

    position_dynamic_elements();
    update_display();
}

function select_tr(tr)
{
    var t = $(tr);
    var name = tr.firstChild.innerHTML;

    var i = (tr.parentNode == leftTable) ? 0 : (tr.parentNode == rightTable) ? 1 : null;
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
    if (selectedTab == "All Devices")
        return;

    var a = function(x) { return $(x,actionDiv); };

    var clear_props = function() {
        a(".mode").removeClass("modesel");
        a("*").removeClass('waiting');
        a("#expression").val('');
        a("#rangeSrcMin").val('');
        a("#rangeSrcMax").val('');
        a("#rangeDestMin").val('');
        a("#rangeDestMax").val('');
        set_boundary(a(".boundary"), 0);
    }

    var conns = get_selected(connections);
    if (conns.length > 1) {
        // TODO
        clear_props();
    }
    else if (conns.length == 1) {
        var c = conns[0];
        clear_props();
        a(".mode"+connectionModes[c.mode]).addClass("modesel");
        a("#expression").val(c.expression);
        if (c.range[0]!=null) { a("#rangeSrcMin").val(c.range[0]); }
        if (c.range[1]!=null) { a("#rangeSrcMax").val(c.range[1]); }
        if (c.range[2]!=null) { a("#rangeDestMin").val(c.range[2]); }
        if (c.range[3]!=null) { a("#rangeDestMax").val(c.range[3]); }
        if (c.clip_min!=null) { set_boundary(a("#boundaryMin"),c.clip_min,0);};
        if (c.clip_max!=null) { set_boundary(a("#boundaryMax"),c.clip_max,1);};
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
    if (selectedTab == "All Devices")
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
    if (actionDiv.firstChild)
        actionDiv.removeChild(actionDiv.firstChild);
    actionDiv.appendChild(a);
}

function position_dynamic_elements()
{
    var hT = fullOffset($("#spacerTable")[0]);

    var L = leftTable.parentNode;
    var R = rightTable.parentNode;

    L.style.height =
    R.style.height =
    svgArea.style.height = (document.body.clientHeight - hT.top - 10) + "px";

    L.style.top =
    R.style.top =
    svgArea.style.top = (hT.top) + "px";

    // Allow tables to collapse the columns naturally, and then we'll
    // expand to fill the space if necessary.
    leftTable.style.width = "auto";
    rightTable.style.width = "auto";

    // Need to run this twice, since movement of the table causes
    // appearance or disappearance of scroll bars, which changes the
    // layout.
    var update_tables = function() {
        var h = $("#spacerTable").find("tr").find("td").map(
            function(){return fullOffset(this);});

        L.style.left = h[0].left+"px";
        R.style.left = h[2].left+"px";
        svgArea.style.left = h[1].left+"px";

        L.style.width = h[0].width+"px";
        R.style.width = h[2].width+"px";
        svgArea.style.width = h[1].width+"px";

        if (parseInt(leftTable.offsetWidth) < h[0].width) {
            leftTable.style.width = h[0].width + "px";
        }

        if (parseInt(rightTable.offsetWidth) < h[2].width) {
            rightTable.style.width = h[2].width + "px";
        }
    }
    update_tables();
    update_tables();
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
        update_display();
    });

    command.register("all_signals", function(cmd, args) {
        for (d in args)
            signals.add(args[d].device_name+args[d].name, args[d]);
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        signals.add(args.device_name+args.name, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        signals.remove(args.device_name+args.name);
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
    body.onclick = deselect_all;

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            add_display_tables();
            add_svg_area();
            add_action_div();
            add_tabs();
            command.start();
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
            select_tab(tabDevices);
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
        t.className = "displayTable";
        d.appendChild(t);
        body.insertBefore(d, body.firstChild);
        return t;
    }

    leftTable = make('leftTable');
    rightTable = make('rightTable');
}

function add_svg_area()
{
    var body = document.getElementsByTagName('body')[0];
    svgArea = document.createElementNS(svgns, "svg");
    var l = fullOffset(leftTable);
    var r = fullOffset(rightTable);
    var x = "position:absolute"
        + ";left:" + (l.left+l.width)+"px"
        + ";width:" + (r.left-l.left-l.width)+"px"
        + ";top:" + (l.top)+"px"
        + ";height:" + "5in";
    svgArea.setAttribute("style", x);
    body.insertBefore(svgArea, body.firstChild);

    // the offset* variables are not available for SVG elements in
    // FireFox, so assign them here.
    svgArea.offsetTop = parseInt(svgArea.style.top);
    svgArea.offsetLeft = parseInt(svgArea.style.left);
    svgArea.offsetWidth = parseInt(svgArea.style.width);
    svgArea.offsetHeight = parseInt(svgArea.style.height);
}

function add_tabs()
{
    var body = document.getElementsByTagName('body')[0];
    tabList = document.createElement('ul');
    tabList.className = "topTabs";
    tabDevices = document.createElement('li');
    tabDevices.innerHTML = "All Devices";
    tabDevices.className = "tabsel";
    tabDevices.id = "allDevices";
    tabDevices.onclick = function(e) { select_tab(tabDevices);
                                       e.stopPropagation(); };
    tabList.appendChild(tabDevices);
    body.insertBefore(tabList, body.firstChild);
    selectedTab = tabDevices.innerHTML;
}

function add_action_div()
{
    var body = document.getElementsByTagName('body')[0];
    actionDiv = document.createElement('div');
    body.insertBefore(actionDiv, body.firstChild);

    make_signal_actions();
    add_signal_property_controls();
    make_device_actions();
}

function make_signal_actions()
{
    sigActions = document.createElement('ul');
    sigActions.className = "sigActions";
    var buttonConnect = document.createElement('button');
    buttonConnect.innerHTML = "Connect";
    buttonConnect.id = "btnConnect";
    buttonConnect.onclick = on_connect;
    sigActions.appendChild(buttonConnect);
    var buttonDisconnect = document.createElement('button');
    buttonDisconnect.innerHTML = "Disconnect";
    buttonDisconnect.id = "btnDisconnect";
    buttonDisconnect.onclick = on_disconnect;
    sigActions.appendChild(buttonDisconnect);
}

function make_device_actions()
{
    devActions = document.createElement('ul');
    devActions.className = "devActions";
    var buttonLink = document.createElement('button');
    buttonLink.innerHTML = "Link";
    buttonLink.id = "btnLink";
    buttonLink.onclick = on_link;
    devActions.appendChild(buttonLink);
    var buttonUnlink = document.createElement('button');
    buttonUnlink.innerHTML = "Unlink";
    buttonUnlink.id = "btnUnlink";
    buttonUnlink.onclick = on_unlink;
    devActions.appendChild(buttonUnlink);
}

function add_signal_property_controls()
{
    var controls = document.createElement('div');
    controls.className = "signalControlsDiv";

    var modesdiv = document.createElement('div');
    modesdiv.className = "modesDiv";
    for (m in connectionModesDisplayOrder) {
        var d = document.createElement('div');
        d.innerHTML = connectionModesDisplayOrder[m];
        d.className = "mode mode"+connectionModesDisplayOrder[m];
        d.onclick = function(m) { return function(e) {
            selected_connection_set_mode(m);
            e.stopPropagation();
            }; }(connectionModesDisplayOrder[m]);
        modesdiv.appendChild(d);
    }

    var handle_input=function(inp,field,idx) {
        inp.onclick = function(e){e.stopPropagation();};
        inp.onkeyup = function(e){if (e.keyCode==13)
                selected_connection_set(field,inp,idx);};
        inp.onblur = function(){selected_connection_set_input(field,inp,idx);};
    };

    var d = document.createElement('input');
    d.type = 'text';
    d.maxLength = 15;
    d.size = 15;
    d.id = 'expression';
    handle_input(d, 'expression');
    modesdiv.appendChild(d);
    controls.appendChild(modesdiv);

    var rangesdiv = document.createElement('div');
    rangesdiv.className = "rangesDiv";

    var srcrange = document.createElement('div');
    srcrange.className = "range";

    var d = document.createElement('div');
    d.innerHTML = "Source Range:";
    srcrange.appendChild(d);

    var d = document.createElement('input');
    d.maxLength = 15;
    d.size = 5;
    d.className = "rangeMin";
    d.id = 'rangeSrcMin';
    handle_input(d, 'range', 0);
    srcrange.appendChild(d);

    var d = document.createElement('div');
    d.className = "rangeSwitch";
    srcrange.appendChild(d);

    var d = document.createElement('input');
    d.maxLength = 15;
    d.size = 5;
    d.className = "rangeMax";
    d.id = 'rangeSrcMax';
    handle_input(d, 'range', 1);
    srcrange.appendChild(d);
    rangesdiv.appendChild(srcrange);

    var destrange = document.createElement('div');
    destrange.className = "range";

    var d = document.createElement('div');
    d.innerHTML = "Dest Range:";
    destrange.appendChild(d);

    var d = document.createElement('div');
    d.className = "boundary boundaryClamp";
    d.onclick = on_boundary;
    d.id = "boundaryMin";
    destrange.appendChild(d);

    var d = document.createElement('input');
    d.maxLength = 15;
    d.size = 5;
    d.className = "rangeMin";
    d.id = 'rangeDestMin';
    handle_input(d, 'range', 2);
    destrange.appendChild(d);

    var d = document.createElement('div');
    d.className = "rangeSwitch";
    destrange.appendChild(d);

    var d = document.createElement('input');
    d.maxLength = 15;
    d.size = 5;
    d.className = "rangeMax";
    d.id = 'rangeDestMax';
    handle_input(d, 'range', 3);
    destrange.appendChild(d);

    var d = document.createElement('div');
    d.className = "boundary boundaryClamp";
    d.onclick = on_boundary;
    d.id = "boundaryMax";
    destrange.appendChild(d);

    rangesdiv.appendChild(destrange);

    controls.appendChild(rangesdiv);

    sigActions.appendChild(controls);
}

/* Kick things off. */
window.onload = main;
