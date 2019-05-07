//++++++++++++++++++++++++++++++++++++++//
//           Console View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ConsoleView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('console', frame, tables, canvas, database, tooltip, pie);

        // hide left table
        tables.left.adjust(0, 0, 0, frame.height, 0, 500);

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500);

        let self = this;
        this.database.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);
            // remove device svg
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        // remove map svg
        this.database.maps.each(remove_object_svg);

        this.escaped = false;

        this.pan = function() {};
        this.zoom = function() {};

        this.setup();
    }

    setup() {
        $('#container').append("<div id='consoleDiv' class='console' "+
                               "style='left:0px; border-right:1px solid gray'>"+
                                   "<div id='consoleHistory'></div>"+
                               "</div>");

        function print_dev_props(dev) {
            let s = ' url: '+dev['host']+':'+dev['port']+';';
            let keys = Object.keys(dev).sort();
            for (var i in keys) {
                let s2 = '';
                let key = keys[i];
                switch (key) {
                    case 'key':
                    case 'links':
                    case 'name':
                    case 'signals':
                    case 'view':
                    case 'hue':
                    case 'angle':
                    case 'link_angles':
                    case 'index':
                    case 'numVisibleSigs':
                    case 'num_incoming_maps':
                    case 'num_outgoing_maps':
                    case 'num_inputs':
                    case 'num_outputs':
                    case 'num_links':
                    case 'status':
                    case 'synced':
                    case 'host':
                    case 'port':
                        break;
                    default:
                        s += " "+key+": "+dev[key]+";";
                }
                if (s.length + s2.length > 140) {
                    echo(s);
                    s = '   '+s2;
                }
                else
                    s += s2;
            }
            s += ' sigs: ['+dev['num_inputs']+' in, '+dev['num_outputs']+' out];';
            s += ' maps: ['+dev['num_incoming_maps']+' in, '+dev['num_outgoing_maps']+' out];';
            return s;
        }

        function print_sig_props(sig) {
            let s = ""
            let keys = Object.keys(sig).sort();
            for (let i in keys) {
                let key = keys[i];
                switch (key) {
                    case 'device':
                    case 'status':
                    case 'key':
                    case 'name':
                    case 'view':
                    case 'index':
                    case 'num_maps':
                    case 'num_incoming_maps':
                    case 'num_outgoing_maps':
                    case 'position':
                    case 'direction':
                    case 'type':
                    case 'length':
                        break;
                    case 'min':
                    case 'max':
                        let v = sig[key];
                        if (Array.isArray(v)) {
                            for (let j in v)
                                v[j] = v[j].toFixed(3);
                        }
                        else
                            v = v.toFixed(3);
                        s += " "+key+": "+v+";";
                        break;
                    default:
                        s += " "+key+": "+sig[key]+";";
                }
            }
            s += ' maps: ['+sig['num_incoming_maps']+' in, '+sig['num_outgoing_maps']+' out]; ';
            return s;
        }

        function print_slot_props(slot) {
            let color = Raphael.hsl(slot.signal.device.hue, 1, 0.5);
            let s = '[[;'+color+';] '+slot.signal.key+':]';
            let keys = Object.keys(slot).sort();
            let v;
            for (var i in keys) {
                let key = keys[i];
                switch (key) {
                    case 'position':
                    case 'signal':
                        break;
                    case 'min':
                    case 'max':
                        s += " "+key+": ";
                        v = slot[key];
                        if (Array.isArray(v)) {
                            len = v.length;
                            s += "[";
                            for (let j in v) {
                                s += v[j].toFixed(3);
                                if (j < len-1)
                                    s += ",";
                            }
                            s += "]";
                        }
                        else
                            s += v.toFixed(3);
                        s += ";";
                        break;
                    case 'calibrating':
                    case 'causes_update':
                    case 'use_instances':
                        v = slot[key] == 'true' ? 'T' : 'F';
                        s += " "+key+": "+v+";";
                        break;
                    default:
                        s += " "+key+": "+slot[key]+";";
                }
            }
            return s;
        }

        function print_map_props(map) {
            let s = '   ';
            let keys = Object.keys(map).sort();
            for (var i in keys) {
                let s2 = '';
                let key = keys[i];
                let v;
                switch (key) {
                    case 'src':
                    case 'srcs':
                    case 'dst':
                    case 'key':
                    case 'view':
                    case 'hidden':
                    case 'status':
                        break;
                    case 'muted':
                        v = map[key] == 'true' ? 'T' : 'F';
                        s2 += " "+key+": "+v+";";
                        break;
                    default:
                        s2 += " "+key+": "+map[key]+";";
                }
//                if (s.length + s2.length > 140) {
//                    echo(s);
//                    s = '   '+s2;
//                }
//                else
                    s += s2;
            }
            for (var i in map.srcs)
                s += "\n    src"+i+":"+print_slot_props(map.srcs[i]);
            s += "\n    dst:"+print_slot_props(map.dst);

            return s;
        }

        jQuery(function($, undefined) {
            $('#consoleHistory').terminal(function(cmd) {
                if (cmd === '')
                    return;

                let echo = this.echo;
                cmd = cmd.split(' ');
                switch (cmd[0]) {
                    case 'help':
                        echo('Available commands:');
                        echo('  ls: list objects in the graph, using the following flags:');
                        echo('      -d    devices');
                        echo('      -s    signals');
                        echo('      -l    links');
                        echo('      -m    maps');
                        echo('  map <srcs> -> <dst>: create a map from <srcs> to <dst>');
                        echo('  unmap <srcs> -> <dst>: remove map from <src> to <dst>');
                        echo('  unmap <index>: remove the map at the specified index');
                        echo('  mod <src> <dst> <properties>: add or modify properties of a map');
                        echo('  mod <index> <properties>: add or modify properties of a map');
                        break;
                    case 'ls':
                        if (cmd.length < 2) {
                            echo("Please specify objects to list or type 'help' for usage.");
                            return;
                        }
                        let flags = cmd[1];
                        if (flags[0] != '-') {
                            echo("Please specify objects to list or type 'help' for usage.");
                            return;
                        }
                        let devFilter = cmd.length > 2 ? self.database.devices.find(cmd[2]) : null;
                        let showDevices = flags.indexOf('d') > 0;
                        let showSignals = flags.indexOf('s') > 0;
                        let showLinks = flags.indexOf('l') > 0;
                        let showMaps = flags.indexOf('m') > 0;
                        let showDetail = flags.indexOf('f') > 0;
                        let color;
                        let devIdx = 1;
                        let devCount = self.database.devices.size();
                        if (showDevices || showSignals) {
                            if (devFilter)
                                echo('Devices (1 of '+devCount+'):');
                            else
                                echo('Devices ('+devCount+'):');
                            self.database.devices.each(function(dev) {
                                if (devFilter && dev !== devFilter)
                                    return;
                                color = Raphael.hsl(dev.hue, 1, 0.5);
                                echo(' '+devIdx+') [[;'+color+';]'+dev.key+']');
                                if (showDevices && showDetail) {
                                    let s = '    [[;'+color+';]|] ';
                                    s += print_dev_props(dev);
                                    echo(s);
                                }
                                let sigCount = dev['num_inputs'] + dev['num_outputs'];
                                if (showSignals && sigCount > 0) {
                                    dev.signals.each(function (sig) {
                                        sigCount -= 1;
                                        let t = sigCount > 0 ? "├─ " : "└─ ";
                                        let s = ' [[;'+color+';]   '+t+sig.name+']';
                                        s += ' ('+(sig['direction']=='output'?'out, ':'in, ');
                                        s += sig['type']+sig['length']+')';
                                        echo(s);
                                        if (showDetail) {
                                            s = sigCount > 0 ? '    [[;'+color+';]|] ' : '      ';
                                            s += print_sig_props(sig);
                                            echo(s);
                                        }
                                    });
                                }
                                devIdx += 1;
                            });
                        }
                        if (showLinks) {
                            let linkIdx = 1;
                            let linkCount = self.database.links.size();
                            echo('Network Links ('+linkCount+'):');
                            self.database.links.each(function (link) {
                                let s = ' '+linkIdx+') ';
                                color = Raphael.hsl(link.src.hue, 1, 0.5);
                                s += '[[;'+color+';]'+link.src.name+']';
                                s += '[[;white;]<->]';
                                color = Raphael.hsl(link.dst.hue, 1, 0.5);
                                s += '[[;'+color+';]'+link.dst.name+']';
                                echo(s);
                                linkIdx += 1;
                            });
                        }
                        if (showMaps) {
                            let mapIdx = 1;
                            let mapCount = self.database.maps.size();
                            echo('Maps ('+mapCount+'):');
                            self.database.maps.each(function (map) {
                                let s = ' '+mapIdx+') ';
                                let len = map.srcs.length;
                                if (len > 1)
                                    s += '[[;white;]\[]';
                                for (var i in map.srcs) {
                                    color = Raphael.hsl(map.srcs[i].signal.device.hue, 1, 0.5);
                                    s += '[[;'+color+';]'+map.srcs[i].signal.device.name+'/'+map.srcs[i].signal.name+']';
                                    if (i < len-1)
                                        s += '[[;white;],]';
                                }
                                if (len > 1)
                                    s += '[[;white;]\\]';
                                s += ' [[;white;]->] ';
                                color = Raphael.hsl(map.dst.signal.device.hue, 1, 0.5);
                                s += '[[;'+color+';]'+map.dst.signal.device.name+'/'+map.dst.signal.name+']';
                                echo(s);
                                if (showDetail) {
                                    echo(print_map_props(map));
                                }
                                mapIdx += 1;
                            });
                        }
                        break;
                    case 'map':
                        if (cmd.length == 3)
                            mapper.map(cmd[1], cmd[2]);
                        else if (cmd.length == 4 && cmd[2] == '->')
                            mapper.map(cmd[1], cmd[3]);
                        else
                            echo('map: wrong number of arguments');
                        break;
                    case 'unmap':
                    case 'rm':
                        if (cmd.length == 2) {
                            let index = 0;
                            self.database.maps.each(function(map) {
                                if (++index == cmd[1]) {
                                    mapper.unmap(map.srcs.map(s => s.key),
                                                 map.dst.key);
                                }
                            });
                        }
                        else if (cmd.length == 3)
                            mapper.unmap(cmd[1], cmd[2]);
                        else
                            echo('unmap: wrong number of arguments');
                        break;
                    case 'select':
                    case 'sel':
                        let updated = false;
                        if (cmd.length == 2) {
                            let index = 0;
                            self.database.maps.each(function(map) {
                                if (++index == cmd[1])
                                    updated |= select_obj(map);
                                else if (map.selected) {
                                    map.selected = false;
                                    updated |= true;
                                }
                            });
                        }
                        else if (cmd.length == 3) {
                            let key = cmd[1]+'->'+cmd[2];
                            self.database.maps.each(function(map) {
                                if (key == map.key)
                                    updated |= select_obj(map);
                                else if (map.selected) {
                                    map.selected = false;
                                    updated |= true;
                                }
                            });
                        }
                        else {
                            echo('modify: wrong number of arguments');
                            break;
                        }
                        if (updated) {
                            $('#container').trigger("updateMapProperties");
                            self.updateMaps();
                        }
                        break;
                    case 'modify':
                    case 'mod':
                        let msg = {};
                        let i = 1;
                        if (/^\d*$/.test(cmd[1])) {
                            // arg is map index
                            let index = 0;
                            self.database.maps.each(function(map) {
                                if (++index == parseInt(cmd[1])) {
                                    msg['srcs'] = map.srcs.map(s => s.signal.key);
                                    msg['dst'] = map.dst.signal.key;
                                    i = 2;
                                }
                            });
                            if (i != 2)
                                break;
                        }
                        else {
                            let srcs = []
                            while (cmd[i] != '->') {
                                if (i >= cmd.length)
                                    return;
                                srcs.push(cmd[i]);
                                i++;
                            }
                            if (++i >= cmd.length)
                                return;
                            msg['srcs'] = srcs;
                            msg['dst'] = cmd[i];
                            i++;
                        }
                        while (i < cmd.length - 1) {
                            msg[cmd[i]] = cmd[i+1];
                            i++;
                        }
                        command.send("set_map", msg);
                        break;
                    case 'echo':
                        echo(cmd.slice(1).join(' '));
                        break;
                    default:
                        echo('unknown command: '+cmd[0]);
                        break;
                }
            }, {
                greetings: '',
                name: 'mapper_console',
                height: '100%',
                width: '100%',
                prompt: 'mapper> ',
                completion: function(string, callback) {
                    let match = [];
                    if (string.indexOf('/') < 0) {
                        self.database.devices.each(function (dev) {
                            if (dev.name.startsWith(string)) {
                                match.push(dev.name);
                            }
                        });
                    }
                    else {
                        // need exact device match
                        string = string.split('/', 2);
                                          console.log(string);
                        let dev = self.database.devices.find(string[0]);
                        if (dev) {
                            dev.signals.each(function (sig) {
                                if (sig.name.startsWith(string[1])) {
                                    match.push(dev.name+'/'+sig.name);
                                }
                            });
                        }
                    }
                    callback(match);
                },
                exit: false
            });
        });

        this.resize(null, 500);
    }

    _resize(duration) {
        this.mapPane.left = 0;
        this.mapPane.width = this.frame.width;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    draw(duration) {}

    update() {}

    cleanup() {
        super.cleanup();

        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });

        $('#consoleDiv').remove();
        $('#mapListDiv').remove();
    }
}
