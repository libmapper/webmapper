devices = new Assoc();
signals = new Assoc();
links = new Assoc();
connections = new Assoc();
var drawLine;

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

/* The main program. */
function main()
{
    command.register("all_devices", function(cmd, args) {
        for (d in args)
            devices.add(args[d].name, args[d]);
    });
    command.register("new_device", function(cmd, args) {
        devices.add(args.name, args);
    });
    command.register("del_device", function(cmd, args) {
        devices.remove(args.name);
        if (selectedTab==args.name)
            select_tab(tabDevices);
    });

    command.register("all_signals", function(cmd, args) {
        for (d in args)
            signals.add(args[d].device_name+args[d].name
                        +'/_dir_'+args[d].direction,
                        args[d]);
    });
    command.register("new_signal", function(cmd, args) {
        signals.add(args.device_name+args.name
                    +'/_dir_'+args.direction, args);
    });
    command.register("del_signal", function(cmd, args) {
        signals.remove(args.device_name+args.name
                       +'/_dir_'+args.direction);
    });

    command.register("all_links", function(cmd, args) {
        for (l in args)
            links.add(args[l].src_name+'>'+args[l].dest_name,
                      args[l]);
    });
    command.register("new_link", function(cmd, args) {
        links.add(args.src_name+'>'+args.dest_name, args);
    });
    command.register("del_link", function(cmd, args) {
        links.remove(args.src_name+'>'+args.dest_name);
    });

    command.register("all_connections", function(cmd, args) {
        for (d in args)
            connections.add(args[d].src_name+'>'+args[d].dest_name,
                            args[d]);
        for (d in args)
            update_connection_properties_for(args[d],
                                             get_selected(connections));
    });
    command.register("new_connection", function(cmd, args) {
        connections.add(args.src_name+'>'+args.dest_name, args);
        update_connection_properties_for(args, get_selected(connections));
    });
    command.register("mod_connection", function(cmd, args) {
        connections.add(args.src_name+'>'+args.dest_name, args);
        update_connection_properties_for(args, get_selected(connections));
    });
    command.register("del_connection", function(cmd, args) {
        var conns = get_selected(connections);
        connections.remove(args.src_name+'>'+args.dest_name);
        update_connection_properties_for(args, conns);
    });

    var body = document.getElementsByTagName('body')[0];
    //body.onclick = deselect_all;

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            command.start();
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
        },
        100);
}

/* Kick things off. */
window.onload = main;
