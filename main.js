
devices = new Assoc();
signals = new Assoc();

tabList = null;
tabDevices = null;
selectedTab = null;
leftTable = null;
rightTable = null;
selectLists = {};
actionDiv = null;
devActions = null;
sigActions = null;

function update_display()
{
    update_tabs();
    if (selectedTab == "All Devices")
        update_devices();
    else
        update_signals(selectedTab);

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
        tr.onclick = function(y) { return function() { select_tr(y); }; } (tr);
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
    var keys = devices.keys();
    for (var d in keys) {
        if (t.nextSibling)
            t = t.nextSibling;
        else {
            var x = document.createElement('li');
            x.onclick = function(y) { return function() { select_tab(y); }; } (x);
            t.parentNode.appendChild(x);
            t = x;
        }
        t.innerHTML = devices.get(keys[d]).name;
    }
}

function update_signals()
{
    keys = signals.keys();
    var updaterLeft = new table_updater(leftTable);
    var updaterRight = new table_updater(rightTable);
    for (var s in keys) {
        var k = keys[s];
        var dev = signals.get(k);

        if (dev.device_name == selectedTab)
            updaterLeft.addrow([dev.device_name+dev.name, dev.type, dev.length]);
        if (dev.device_name != selectedTab)
            updaterRight.addrow([dev.device_name+dev.name, dev.type, dev.length]);
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
            signals.add(args[d].name, args[d]);
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        signals.add(args.name, args);
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
        signals.remove(args.name);
        update_display();
    });

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            add_display_tables();
            add_actions();
            add_tabs();
            command.start();
            command.send('all_devices');
            command.send('all_signals');
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

function add_tabs()
{
    var body = document.getElementsByTagName('body')[0];
    tabList = document.createElement('ul');
    tabList.className = "topTabs";
    tabDevices = document.createElement('li');
    tabDevices.innerHTML = "All Devices";
    tabDevices.className = "tabsel";
    tabDevices.id = "allDevices";
    tabDevices.onclick = function() { select_tab(tabDevices); };
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
    sigActions.appendChild(buttonConnect);
    var buttonDisconnect = document.createElement('button');
    buttonDisconnect.innerHTML = "Disconnect";
    buttonDisconnect.id = "btnDisconnect";
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
    devActions.appendChild(buttonLink);
    var buttonUnlink = document.createElement('button');
    buttonUnlink.innerHTML = "Unlink";
    buttonUnlink.id = "btnUnlink";
    devActions.appendChild(buttonUnlink);
    actionDiv.insertBefore(devActions, actionDiv.firstChild);
}

/* Kick things off. */
window.onload = main;
