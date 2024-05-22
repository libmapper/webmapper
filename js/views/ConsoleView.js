//++++++++++++++++++++++++++++++++++++++//
//           Console View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ConsoleView extends View {
    constructor(frame, tables, canvas, graph, tooltip, pie) {
        super('console', frame, tables, canvas, graph, tooltip, pie);

        // hide left table
        tables.left.adjust(0, 0, 0, frame.height, 0, 500);

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500);

        let self = this;
        this.graph.devices.forEach(function(dev) {
            // remove signal svg
            dev.signals.forEach(remove_object_svg);
            // remove device svg
            remove_object_svg(dev);
        });

        // remove link svg
        this.graph.links.forEach(remove_object_svg);

        // remove map svg
        this.graph.maps.forEach(remove_object_svg);

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
                    case 'num_maps_in':
                    case 'num_maps_out':
                    case 'num_sigs_in':
                    case 'num_sigs_out':
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
//                    echo(s);
                    s = '   '+s2;
                }
                else
                    s += s2;
            }
            s += ' sigs: ['+dev['num_sigs_in']+' in, '+dev['num_sigs_out']+' out];';
            s += ' maps: ['+dev['num_maps_in']+' in, '+dev['num_maps_out']+' out];';
            return s;
        }

        function print_sig_props(sig) {
            let s = "";
            let keys = Object.keys(sig).sort();
            for (let i in keys) {
                let key = keys[i];
                let v;
                switch (key) {
                    case 'device':
                    case 'hidden':
                    case 'index':
                    case 'key':
                    case 'name':
                    case 'num_maps':
                    case 'num_maps_in':
                    case 'num_maps_out':
                    case 'position':
                    case 'view':
                        break;
                    case 'type':
                        s += " "+key+": "+type_name(sig[key])+";";
                        break;
                    case 'ephemeral':
                    case 'use_inst':
                        v = sig[key] == true ? 'T' : 'F';
                        s += " "+key+": "+v+";";
                        break;
                    case 'min':
                    case 'max':
                        s += " "+key+": ";
                        v = sig[key];
                        if (Array.isArray(v)) {
                            s += "[";
                            if (sig.type != 'INT32') {
                                for (let j in v)
                                    v[j] = parseFloat(v[j]).toFixed(3);
                            }
                            s += v+"];";
                        }
                        else
                            s += Number.parseFloat(v).toFixed(3)+";";
                        break;
                    case 'period':
                    case 'jitter':
                        s += " "+key+": "+Number.parseFloat(sig[key]).toFixed(3)*1000+"ms;";
                        break;
                    case 'num_instances':
                        if (sig['use_inst'] == false)
                            continue;
                    default:
                        s += " "+key+": "+sig[key]+";";
                }
            }
            s += ' maps: ['+sig['num_maps_in']+' in, '+sig['num_maps_out']+' out]; ';
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
                    case 'selected':
                    case 'status':
                        break;
                    case 'muted':
                    case 'use_inst':
                        v = map[key] == true ? 'T' : 'F';
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
                s += "\n    src"+i+":"+print_sig_props(map.srcs[i]);
            s += "\n    dst:"+print_sig_props(map.dst);

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
                        echo('      -f    show detailed metadata');
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
                        let devFilter = cmd.length > 2 ? self.graph.devices.find(cmd[2]) : null;
                        let showDevices = flags.indexOf('d') > 0;
                        let showSignals = flags.indexOf('s') > 0;
                        let showLinks = flags.indexOf('l') > 0;
                        let showMaps = flags.indexOf('m') > 0;
                        let showDetail = flags.indexOf('f') > 0;
                        let color;
                        let devIdx = 1;
                        let devCount = self.graph.devices.size();
                        if (showDevices || showSignals) {
                            if (devFilter)
                                echo('Devices (1 of '+devCount+'):');
                            else
                                echo('Devices ('+devCount+'):');
                            self.graph.devices.forEach(function(dev) {
                                if (devFilter && dev !== devFilter)
                                    return;
                                color = Raphael.hsl(dev.hue, 1, 0.5);
                                echo(' '+devIdx+') [[;'+color+';]'+dev.key+']');
                                if (showDevices && showDetail) {
                                    let s = '    [[;'+color+';]|] ';
                                    s += print_dev_props(dev);
                                    echo(s);
                                }
                                let sigCount = dev['num_sigs_in'] + dev['num_sigs_out'];
                                if (showSignals && sigCount > 0) {
                                    dev.signals.forEach(function (sig) {
                                        sigCount -= 1;
                                        let t = sigCount > 0 ? "├─ " : "└─ ";
                                        let s = ' [[;'+color+';]   '+t+sig.name+']';
                                        s += ' ('+(sig['direction']=='output'?'out, ':'in, ');
                                        s += sig['type']+'['+sig['length']+'])';
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
                            let linkCount = self.graph.links.size();
                            echo('Network Links ('+linkCount+'):');
                            self.graph.links.forEach(function (link) {
                                let s = ' '+linkIdx+') ';
                                color = Raphael.hsl(link.src.hue, 1, 0.5);
                                s += '[[;'+color+';]'+link.src.name+']';
                                s += '[[;white;] <-> ]';
                                color = Raphael.hsl(link.dst.hue, 1, 0.5);
                                s += '[[;'+color+';]'+link.dst.name+']';
                                echo(s);
                                linkIdx += 1;
                            });
                        }
                        if (showMaps) {
                            let mapIdx = 1;
                            let mapCount = self.graph.maps.size();
                            echo('Maps ('+mapCount+'):');
                            self.graph.maps.forEach(function (map) {
                                let s = ' '+mapIdx+') ';
                                let len = map.srcs.length;
                                if (len > 1)
                                    s += '[[;white;]\[]';
                                for (var i in map.srcs) {
                                    color = Raphael.hsl(map.srcs[i].device.hue, 1, 0.5);
                                    s += '[[;'+color+';]'+map.srcs[i].device.name+'/'+map.srcs[i].name+']';
                                    if (i < len-1)
                                        s += '[[;white;],]';
                                }
                                if (len > 1)
                                    s += '[[;white;]\\]]';
                                s += ' [[;white;]->] ';
                                color = Raphael.hsl(map.dst.device.hue, 1, 0.5);
                                s += '[[;'+color+';]'+map.dst.device.name+'/'+map.dst.name+']';
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
                            self.graph.maps.forEach(function(map) {
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
                            self.graph.maps.forEach(function(map) {
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
                            self.graph.maps.forEach(function(map) {
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
                        let srcs = [];
                        let dst;
                        let msg = {};
                        let argidx = 0;
                        if (/^\d*$/.test(cmd[1])) {
                            // arg is map index
                            let index = 0;
                            self.graph.maps.forEach(function(map) {
                                if (++index == parseInt(cmd[1])) {
                                    srcs = map.srcs.map(s => s.key);
                                    dst = map.dst.key;
                                    argidx = 2;
                                }
                            });
                            if (argidx != 2)
                                break;
                        }
                        else {
                            while (cmd[i] != '->') {
                                if (i >= cmd.length)
                                    return;
                                srcs.push(cmd[i]);
                                i++;
                            }
                            if (++i >= cmd.length)
                                return;
                            dst = cmd[i];
                            argidx++;
                        }
                        while (argidx < cmd.length - 1) {
                            msg[cmd[argidx]] = cmd[argidx+1];
                            argidx++;
                        }
                        console.log("MOD?", srcs, dst, msg);
                        mapper.set(srcs, dst, msg);
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
                        self.graph.devices.forEach(function (dev) {
                            if (dev.name.startsWith(string)) {
                                match.push(dev.name);
                            }
                        });
                    }
                    else {
                        // need exact device match
                        string = string.split('/', 2);
                                          console.log(string);
                        let dev = self.graph.devices.find(string[0]);
                        if (dev) {
                            dev.signals.forEach(function (sig) {
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

        this.graph.devices.forEach(function(dev) {
            dev.signals.forEach(function(sig) {
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
