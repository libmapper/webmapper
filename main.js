
devices = new Assoc();
signals = new Assoc();

tabList = null;
tabDevices = null;
selectedTab = null;
leftTable = null;
rightTable = null;

function update_display()
{
    update_tabs();
    if (selectedTab == "All Devices")
        update_devices();
    else
        update_signals(selectedTab);
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

function select_tab(tab)
{
    selectedTab = tab.innerHTML;
    $(".tabsel").removeClass("tabsel");
    $(tab).addClass("tabsel");
    update_display();
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
            add_tabs();
            command.start();
            command.send('all_devices');
            command.send('all_signals');},
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

/* Kick things off. */
window.onload = main;
