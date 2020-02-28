class CurveGenerator {
    constructor(props, onGenerated) {
        // If curve editor is open, return
        if ($('#curveEditorWindow').length) {
            return;
        }

        // Curvature coefficient
        let c = -4.0;

        $('body').append("<div id='curveEditorWindow' style='position:absolute;left:calc(50% - 25vh);top:25%;background:#494949;width:50vh;height:50vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;'></div>");

        // Grid
        $('#curveEditorWindow').append("<svg style='position:absolute'><pattern id='curveGrid' width='10' height='10' patternUnits='userSpaceOnUse'><path d='M 10 0 L 0 0 0 10' fill='none' stroke='gray' stroke-width='1'/></pattern></svg>");

        var canvas = Raphael($('#curveEditorWindow')[0], '90%', '90%');
        canvas.setViewBox(0, 0, 120, 120);
        
        // Graph frame
        let box = canvas.rect(10, 10, 100, 100, 2).attr({'stroke': '#FFF', 'stroke-width': 1});
        // Set attribute directly on node as Raphael does some weird things to the url
        box.node.setAttributeNS(null, 'fill', 'url(#curveGrid)');

        let points = [];
        this.drawCurve(points, canvas, c);

        // Slider
        $('#curveEditorWindow').append(`<input id='curveSlider' type='range' min='-16.0' max='16.0' step='0.1' value='${c}'>`);
        $('#curveSlider').on('input', (e) => {
            c = $(e.target).val();
            if (c != 0) {
                let p;
                for (p of points) {
                    p.remove();
                }
                points = [];
                this.drawCurve(points, canvas, c);
            }

        });

        // Generate button
        $('#curveEditorWindow').append("<div id='curveGenerate' class='button' style='width:90%;text-align:center;color:white'>Generate</div>");
        $('#curveGenerate').click(function(e) {
            e.stopPropagation();
            let expr = generate_curve(props.src_min,
                               props.src_max,
                               props.dst_min,
                               props.dst_max,
                               c);
            onGenerated(expr);
            $('#curveEditorWindow').remove();
        });
    }

    drawCurve(points, canvas, c) {
        const reso = 20;
        for (let i = 0; i <= reso; i++) {
            let x = i / reso;
            let y = get_curve_val(x, 0.0, 1.0, 0.0, 1.0, c);
            x = 10.0 + x * 100.0;
            y = 110.0 - y * 100.0;
            let circ = canvas.circle(x, y, 1).attr({'fill': '#FFF', 'stroke': '#FFF'});
            points.push(circ);
        }
    }
}
