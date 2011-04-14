
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

function update_display()
{
    update_tabs();
    if (selectedTab == "All Devices") {
        update_devices();
        update_links();
    }
    else {
        update_signals(selectedTab);
        update_connections();
    }

    update_selection();
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
                $('td:contains('+l.dest_name+')', rightTable).each(
                    function(i,e){
                        var right = e.parentNode;
                        create_arrow(left, right);
                    });
            });
    }
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
                $('td:contains('+c.dest_name+')', rightTable).each(
                    function(i,e){
                        var right = e.parentNode;
                        create_arrow(left, right);
                    });
            });
    }
}

/* params are TR elements, one from each table */
function create_arrow(left, right)
{
    var line = document.createElementNS(svgns, "path");
    line.setAttribute("stroke", "black");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke-width", 2);

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

    svgArea.appendChild(line);
    arrows.push(line);
}

function select_tab(tab)
{
    selectedTab = tab.innerHTML;
    $(".tabsel").removeClass("tabsel");
    $(tab).addClass("tabsel");

    if (tab == tabDevices) {
        $(sigActions).css("visibility","hidden");
        $(devActions).css("visibility","visible");
    } else {
        $(devActions).css("visibility","hidden");
        $(sigActions).css("visibility","visible");
    }

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
    var types = ["boundaryNone", "boundaryContinueUp", "boundaryContinueDown",
                 "boundaryMute", "boundaryClamp", "boundaryWrap",
                 null];
    var b = $(e.currentTarget);

    for (t in types) {
        if (b.hasClass(types[t])) {
            var u = types[parseInt(t)+1];
            if (u==null) u = types[0];
            b.removeClass(types[t]);
            b.addClass(u);
            break;
        }
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
    });
    command.register("new_connection", function(cmd, args) {
        connections.add(args.src_name+'>'+args.dest_name, args);
        update_display();
    });
    command.register("del_connection", function(cmd, args) {
        connections.remove(args.src_name+'>'+args.dest_name);
        update_display();
    });

    var body = document.getElementsByTagName('body')[0];
    body.onclick = deselect_all;

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            add_display_tables();
            add_svg_area();
            add_actions();
            add_tabs();
            command.start();
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
            select_tab(tabDevices);
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

function add_actions()
{
    var body = document.getElementsByTagName('body')[0];
    actionDiv = document.createElement('div');
    body.insertBefore(actionDiv, body.firstChild);

    add_signal_actions();
    add_signal_property_controls();
    add_device_actions();
}

function add_signal_actions()
{
    sigActions = document.createElement('ul');
    sigActions.className = "sigActions";
    sigActions.style.position = "absolute";
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
    actionDiv.insertBefore(sigActions, actionDiv.firstChild);
}

function add_device_actions()
{
    devActions = document.createElement('ul');
    devActions.className = "devActions";
    devActions.style.position = "absolute";
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
    actionDiv.insertBefore(devActions, actionDiv.firstChild);
}

function add_signal_property_controls()
{
    var controls = document.createElement('div');
    controls.style.display = "inline-block";

    var i = document.createElement('div');
    i.className = "boundary boundaryClamp";
    i.onclick = on_boundary;
    controls.appendChild(i);

    sigActions.appendChild(controls);
}

/* Kick things off. */
window.onload = main;
