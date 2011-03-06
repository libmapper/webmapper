
function test_send()
{
    div = document.createElement('div');
    inp = document.createElement('input');
    inp.value = "Send /test,asdf,123";
    inp.type = "button";
    inp.onclick = function(){command.send('/test', ['asdf', 123]);}
    div.appendChild(inp);
    document.body.insertBefore(div, document.getElementById('output'));
}

devices = new Assoc();

function update_display()
{
    document.getElementById('output').innerHTML = "";
    keys = devices.keys();
    for (var d in keys) {
        var k = keys[d];
        var dev = devices.get(k);
        trace(dev.name + ', ' + dev.host + ', ' + dev.port);
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

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            command.start();
            command.send('all_devices');},
        100);

    test_send();
}

/* Kick things off. */
window.onload = main;
