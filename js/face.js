$(function app() {
    $('#image000').on('load', function() {
        refresh();
    });
    var canavasedGPU = 0;
    var canavased = 0;
    var lenaGPU = new LenaGPU({width: 512, height: 512});
    let fullFaceDescriptions = null;
    let haha = null;
    // var lenaGPU2 = new LenaGPU({width:640, height:480, gpu: new GPU()});

    async function testNormal() {
        let MODEL_URL = './js/weights';
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
            await faceapi.loadFaceLandmarkModel(MODEL_URL)
                await faceapi.loadFaceRecognitionModel(MODEL_URL)
    }

    testNormal();

    (function() {
        let img = $('#image000');
        if (!img[0].complete) return;
        if ($('#image000').width() > 512) {
            $('#display0').children().addClass('stdsize');
            refresh();
        } else if ($('#image000').width() > 0) {
            refresh();
        }
    })()

    function refresh() {
        const canvas = $('#canvasimg0')[0];
        const img = $('#image000');
        let w = img.width();
        let h = img.height();
        canvas.width = img.width();
        canvas.height = img.height();

        let canvass = $('canvas.display1');
        canvass.attr('width', w);
        canvass.attr('height', h);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img[0], 0, 0, w, h);
        if ((lenaGPU == null) || (lenaGPU.width != w) ||
            (lenaGPU.height != h)) {
            lenaGPU = new LenaGPU({width: w, height: h});
        }
        fullFaceDescriptions = null;
        haha = null;
    }

    // file menu
    (function() {
        $('#loadimg').click(function() {
            $('#loadlocal').click();
        });
        $('#loadlocal').on('change', function(ev) {
            let input = ev.target;
            if (input.files && input.files[0]) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    $('#image000').attr('src', e.target.result);
                };

                reader.readAsDataURL(input.files[0]);
            }
        });
        $('#filemenu').menu();
    })();


    // menus for filter and edge
    (function() {
        // append menus
        (function appendmenu() {
            let filters = [
                'grayscale', 'invert', 'red', 'green', 'blue', 'mirror', 'flip',
                'sepia', 'saturation', 'thresholding', 'dct', 'idct'
            ];
            let edges = [
                'canny', 'gaussian', 'bigGaussian', 'highpass', 'lowpass3',
                'laplacian', 'lowpass5', 'prewittVertical', 'prewittHorizontal',
                'roberts', 'sharpen', 'sobelVertical', 'sobelHorizontal'
            ];
            let faces = ['bigmouse'];
            function doone(thefilters, themenu) {
                let ula = $('<ul/>');
                thefilters.forEach(function(ele) {
                    ula.append(
                        '<li data-filter=\'' + ele + '\'><div>' + ele +
                        '</div></li>');
                });
                $(themenu).append(ula.children().detach());
            }
            doone(filters, '#filter_menus');
            doone(edges, '#edge_menus');
            doone(faces, '#face_menus');
        })();
        let last_dct_tex = null;
        function dofilterGPU(e, ui) {
            let t = 0;
            let myfilter = ui.item.attr('data-filter');
            if (myfilter) {
                let canvas = $('#canvasGPU')[0];
                // let img = $('#image000')[0];
                let img = $('#canvasimg0')[0];
                let src = img;
                if ($('#AddonToggleButton').is(':checked') && (canavasedGPU)) {
                    src = canvas;
                }
                if (myfilter == 'idct') {
                    src = last_dct_tex;
                }
                {
                    let c;
                    const t0 = performance.now();
                    c = lenaGPU[myfilter](src, canvas);
                    if (myfilter == 'dct' || myfilter == 'idct') {
                        last_dct_tex = c;
                        c = lenaGPU.present(c, canvas).canvas;
                    } else {
                        c = c.canvas;
                    }
                    if (c) {
                        if (canavasedGPU == 0) {
                            $(c).addClass('gpu');
                            $(c).attr('id', 'canvasgpu');
                        }
                        //$("#display0")[0].appendChild(c);

                        canavasedGPU++;
                    }
                    const t1 = performance.now();
                    t = t1 - t0;
                }
                $('#time').html(t.toFixed(1).toString());
            }
        }
        function dofilterCPU(e, ui) {
            let t = 0;
            console.log($('#AddonToggleButton').is(':checked'));
            let myfilter = ui.item.attr('data-filter');
            if (myfilter) {
                console.log(ui.item.attr('data-filter'));
                let img = $('#image000')[0];
                let canvas = $('#canvasCPU')[0];
                if ($('#AddonToggleButton').is(':checked') && (canavased)) {
                    const t0 = performance.now();
                    LenaJS.redrawCanvas(canvas, LenaJS[myfilter]);
                    const t1 = performance.now();
                    t = t1 - t0;
                } else {
                    const t0 = performance.now();
                    LenaJS.filterImage(canvas, LenaJS[myfilter], img);
                    const t1 = performance.now();
                    t = t1 - t0;
                }
                canavased++;
                $('#time').html(t.toFixed(1).toString());
            }
        }
        function dofilter(e, ui) {
            if ($('#GPUToggleButton').is(':checked')) {
                dofilterGPU(e, ui);
            } else {
                dofilterCPU(e, ui);
            }

            if (fullFaceDescriptions) {
                let canvas2 = $('#canvasGPU')[0];
                // faceapi.draw.drawDetections(canvas2, fullFaceDescriptions);
                faceapi.draw.drawFaceLandmarks(canvas2, fullFaceDescriptions);
            }
        }
        $('#filtermenu').menu({select: dofilter});
        $('#edgemenu').menu({select: dofilter});
    })();

    let scaleface = null;
    let webCS = null;
    class HahaFace {
        constructor(webCS, descr, settings = {}) {
            this.webCS = webCS || new WebCS();
            this.faceDesc = descr;
            this.shaders = {};
            let X = webCS.canvas.width, Y = webCS.canvas.height;
            this.shaders.bigmouse = this.webCS.createShader(function(src, dst) {
                return `
                    uint anchor0X = this.uniform.anchor0.x;
                    uint anchor0Y = this.uniform.anchor0.y;
                    uint anchor1X = this.uniform.anchor0.z;
                    uint anchor1Y = this.uniform.anchor0.w;

                    uint anchor2X = this.uniform.anchor1.x;
                    uint anchor2Y = this.uniform.anchor1.y;
                    uint anchor3X = this.uniform.anchor1.z;
                    uint anchor3Y = this.uniform.anchor1.y;
                    uint anchor4X = anchor2X;
                    uint anchor4Y = this.uniform.anchor1.w;
                    if(thread.x > anchor2X && thread.x < anchor3X && thread.y > anchor2Y && thread.y < anchor4Y){
                        uint y = thread.y;
                        uint x = 0u;
                        float ratio = 0.0;
                        uint middleX = (anchor0X + anchor1X ) / 2u;
                        uint middleY = (anchor2Y + anchor4Y ) / 2u;
                        if(thread.x < middleX){
                            uint distX = middleX - thread.x;
                            uint shortX = middleX - anchor0X;
                            uint longX = middleX - anchor2X;
                            x = middleX - shortX * distX / longX;
                            ratio = float(thread.x - anchor2X) / float(anchor0X - anchor2X);
                            if ( ratio > 1.0) ratio = 1.0;
                        }else{
                            uint distX  = thread.x - middleX ;
                            uint shortX = anchor1X - middleX ;
                            uint longX  = anchor3X - middleX ;
                            x = middleX + shortX * distX / longX;
                            ratio = float(anchor3X - thread.x) / float(anchor3X - anchor1X);
                            if ( ratio > 1.0) ratio = 1.0;
                        }
                        float distY = float(anchor4Y - anchor2Y) / 2.0;
                        float ratio2 = (distY - abs(float(thread.y) - float(middleY))) / distY;
                        ratio2 = ratio2 * 2.0;
                        ratio2 = min(ratio2, 1.0);
                        ratio = ratio * ratio2;
                        vec4 c0 = src[y][x];
                        vec4 c1 = src[thread.xy];
                        vec4 c00 = c0 * ratio;
                        vec4 c11 = c1 * (1.0 - ratio);
                        vec4 c = c00 + c11;
                        dst[thread.xy] = c;
                    }else{
                        dst[ivec2(thread.xy)] = src[ivec2(thread.xy)];
                    }
                    `;
            }, {
                local_size: [8, 8, 1],
                groups: [X / 8, Y / 8, 1],
                params: {src: '[][]', 'dst': 'texture'}
            });
        }
        bigmouse(srcCanvas) {
            let poss = this.faceDesc[0].landmarks.positions;
            let anchor0 = [poss[48].x, poss[48].y, poss[54].x, poss[54].y];
            let ry = (poss[33].y + Math.min(poss[50].y, poss[52].y)) / 2.0;
            let ry2 = (poss[8].y + poss[57].y) / 2.0;
            let anchor1 = [
                (poss[48].x + poss[3].x) / 2.0, ry,
                (poss[13].x + poss[54].x) / 2.0, ry2
            ];
            let X = srcCanvas.width, Y = srcCanvas.height;
            this.shaders.bigmouse.run(
                srcCanvas, null, X / 8, Y / 8, 1,
                {'anchor0': anchor0, 'anchor1': anchor1});
            let tex = this.shaders.bigmouse.getTexture('dst');
            webCS.present(tex);
        }
    };

    // face menu
    (function() {
        async function testface() {
            const input = $('#image000')[0];
            let canvas = $('#canvasimg0')[0];
            let canvas2 = $('#canvasGPU')[0];
            if (fullFaceDescriptions == null) {
                fullFaceDescriptions = await faceapi.detectAllFaces(canvas)
                                           .withFaceLandmarks()
                                           .withFaceDescriptors();
            }
            console.log(fullFaceDescriptions);
            faceapi.draw.drawDetections(canvas2, fullFaceDescriptions);
            faceapi.draw.drawFaceLandmarks(canvas2, fullFaceDescriptions);
            if (fullFaceDescriptions.length == 0) return;
            if (haha == null) {
                let c2 = $('#canvas2GPU')[0];
                webCS = new WebCS({canvas: c2});
                haha = new HahaFace(webCS, fullFaceDescriptions);
            }
            haha.bigmouse(canvas);
        }

        function doface(e, ui) {
            let myfilter = ui.item.attr('data-filter');
            if (myfilter == null) return;
            if (myfilter == 'bigmouse') {
                testface();
            }
        }
        $('#facemenu').menu({select: doface});
    })();

    // view menu
    $('#viewmenu').menu({
        select: function(e, ui) {
            let cmd = ui.item.attr('cmd');
            if (cmd == 0) {
                $('.display1').removeClass('stdsize');
                let w = $('#image000').width(), h = $('#image000').height()
                lenaGPU = new LenaGPU({width: w, height: h, gpu: lenaGPU.gpu});
            } else if (cmd == 1) {
                $('.display1').addClass('stdsize');
                let w = $('#image000').width(), h = $('#image000').height()
                lenaGPU = new LenaGPU({width: w, height: h, gpu: lenaGPU.gpu});
            }
            if (cmd != undefined) {
                let w = $('#image000').width(), h = $('#image000').height()
                let canvas = $('canvas.display1');
                canvas.attr('width', w);
                canvas.attr('height', h);
                refresh();
            }
        }
    });

    // right buttons
    (function() {
        $('#AddonToggleButton').button();
        $('#GPUToggleButton').button();
        $('#timediv').button();
        $('#TestGPU').button();
    })();

    // message box
    function onMessage(txt) {
        $('#messagebox').html(txt);
        if (txt && txt.length > 0) {
            $('#messagebox').addClass('ui-tooltip');
        } else {
            $('#messagebox').removeClass('ui-tooltip');
        }
    };
    $('#meesagebox').button();
    $('#canvasGPU')
        .hover(
            function() {
                onMessage('GPU Canvase');
            },
            function() {
                onMessage('');
            });
    $('#canvasCPU')
        .hover(
            function() {
                onMessage('CPU Canvase');
            },
            function() {
                onMessage('');
            });
    $(document).tooltip();

    // test code
    (function testcs() {
        const generateMatrices = () => {
            const matrices = [[], []];
            for (let y = 0; y < 64; y++) {
                matrices[0].push([])
                matrices[1].push([])
                for (let x = 0; x < 64; x++) {
                    matrices[0][y].push(Math.random())
                    matrices[1][y].push(Math.random())
                }
            }
            return matrices
        };
        const gpu = new (GPUJS || GPU)();
        const multiplyMatrix =
            gpu.createKernel(function(a, b) {
                   let sum = 0;
                   for (let i = 0; i < 64; i++) {
                       sum += a[this.thread.y][i] * b[i][this.thread.x];
                   }
                   return sum;
               })
                .setOutput([64, 64]);
        const matrices = generateMatrices();
        $('#TestGPU').click(function() {
            const out = multiplyMatrix(matrices[0], matrices[1]);
            console.log(out);
        });
    })();
});
