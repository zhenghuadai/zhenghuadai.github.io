(function(win) {
class HahaFace {
        constructor(webCS, descr, settings = {}) {
            this.webCS = webCS || new WebCS();
            this.faceDesc = descr;
            this.shaders = {};
            let X = webCS.canvas.width, Y = webCS.canvas.height;
            this.webCS.addFunctions(`
               float enreduce(float eX0, float eX1, float _bX0, float _bX1, float _sX0, float _sX1, float _x){
                   //eX0 _bX0  _sX0    _sX1  _bX1 eX1
                   float bX0 = float(_bX0);
                   float bX1 = float(_bX1);
                   float sX0 = float(_sX0);
                   float sX1 = float(_sX1);
                   float x   = float(_x);
                   //float eX0 = bX0 - (sX0 - bX0);
                   //float eX1 = bX1 + (bX1 - sX1);
                   float newx = 0.0;
                   if( x >= sX0 && x <= sX1){
                       // reduce
                       newx = bX0 + ((x - sX0)*(bX1 - bX0)/(sX1-sX0));
                   }else if(x<sX0){
                       //enlarge
                       newx = eX0 + ((x - eX0)*(bX0 - eX0)/(sX0-eX0));
                   }else{
                       newx = eX1 - ((eX1 - x)*(eX1 - bX1)/(eX1-sX1));
                   }
                   return float(max(newx, 0.0));
               }`);
            this.shaders.largeX= this.webCS.createShader(function(src, dst) {
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
                        uint anchor2Xa = anchor2X;
                        if(thread.x < middleX){
                            //anchor2Xa = anchor2X + uint(abs(float(anchor0X - anchor2X)*float(thread.y-anchor0Y)/ (float(anchor2Y - anchor0Y))));
                            uint distX = middleX - thread.x;
                            uint shortX = middleX - anchor0X;
                            uint longX = middleX - anchor2Xa;
                            x = middleX - shortX * distX / longX;
                            ratio = float(thread.x - anchor2Xa) / float(anchor0X - anchor2Xa + 5u);
                            if ( ratio > 1.0) ratio = 1.0;
                            if(thread.x < anchor2Xa) ratio = 0.0;
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

            this.shaders.smallHead= this.webCS.createShader(function(src, dst) {
                return `
                    //    2           5
                    //       0 1
                    // 4          3
                    float anchor0X = this.uniform.anchor0.x;
                    float anchor0Y = this.uniform.anchor0.y;
                    float anchor1X = this.uniform.anchor0.z;
                    float anchor1Y = this.uniform.anchor0.w;

                    float anchor2X = this.uniform.anchor1.x;
                    float anchor2Y = this.uniform.anchor1.y;
                    float anchor3X = this.uniform.anchor1.z;
                    float anchor3Y = this.uniform.anchor1.w;
                    float anchor4X = max(0.0, anchor2X - (anchor0X-anchor2X));
                    float anchor4Y = this.uniform.anchor1.w;
                    float anchor5X = anchor3X + (anchor3X-anchor1X);
                    float y = float(thread.y);
                    float x = float(thread.x);
                    float longx = anchor3X - anchor2X;
                    float shortx = anchor1X - anchor0X;
                    float marginx = (longx - shortx)/2.0;
                    float middlex = (anchor0X + anchor1X) / 2.0;
                    if(x > anchor4X && x < anchor5X && y > anchor2Y && y < anchor4Y){
                        if(x < middlex){
                            float dx = float(abs(((float(y) - float(anchor2Y)) * float(anchor0X - anchor2X)/ (float(anchor3Y)-float(anchor2Y)))));
                            float sx0 = anchor0X - dx;
                            x = enreduce(anchor4X, middlex, anchor2X, middlex, sx0, middlex, x);    
                        }else{
                            float dx1 = float(abs(((float(y) - float(anchor2Y)) * float(anchor3X - anchor1X)/ (float(anchor3Y)-float(anchor2Y)))));
                            float sx1 = anchor1X + dx1;
                            x = enreduce(middlex, anchor5X, middlex, anchor3X, middlex, sx1, x);    
                        }
                        dst[thread.xy] = src[y][x];
                    }else{
                        dst[thread.xy] = src[thread.xy];
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
            this.shaders.largeX.run(
                srcCanvas, null, X / 8, Y / 8, 1,
                {'anchor0': anchor0, 'anchor1': anchor1});
            let tex = this.shaders.largeX.getTexture('dst');
            this.webCS.present(tex);
        }
        smallHead(srcCanvas){
            let poss = this.faceDesc[0].landmarks.positions;
            let anchor0 = [poss[21].x, poss[21].y, poss[22].x, poss[22].y];
            let ry = poss[19].y - (poss[6].y - poss[19].y);
            let ry2 = poss[8].y + (poss[8].y - poss[57].y);
            let anchor1 = [
                poss[0].x - (poss[36].x-poss[0].x) / 2.0, ry,
                poss[16].x + (poss[16].x-poss[45].x) / 2.0, ry2
            ];
            /*
            let anchor0 = [292.7475664615631,
                248.55869632959366,
                327.3667411804199,
                249.22095814347267];
            let anchor1 = [183.0354899317026,
                 164.06927141547203,
                 357.50328278541565,
                 375.13288217782974];
                 */
            let X = srcCanvas.width, Y = srcCanvas.height;
            this.shaders.smallHead.run(
                srcCanvas, null, X / 8, Y / 8, 1,
                {'anchor0': anchor0, 'anchor1': anchor1});
            let tex = this.shaders.smallHead.getTexture('dst');
            this.webCS.present(tex);

        }
    };

win.HahaFace = HahaFace;
})(window);
