
devices = new Assoc();
leftTable = null;
rightTable = null;

function update_display()
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
    updaterLeft.apply()
    updaterRight.apply()
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
    tab.style.height = "3in";
    tab.style.overflow = "scroll";
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

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            add_display_tables();
            command.start();
            command.send('all_devices');},
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

/* Kick things off. */
window.onload = main;
