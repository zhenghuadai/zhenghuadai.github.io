(function(win) {
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

win.HahaFace = HahaFace;
})(window);
