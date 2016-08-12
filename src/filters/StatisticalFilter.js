/**
*
* Statistical Filter(s)
*
* Applies statistical filtering/processing to target image
*
* @package FILTER.js
*
**/
!function(FILTER, undef){
"use strict";

// used for internal purposes
var IMG = FILTER.ImArray, A32I = FILTER.Array32I, TypedArray = FILTER.Util.Array.typed,
    Min = Math.min, Max = Math.max, Filters;
    
//
//
//  Statistical Filter
var StatisticalFilter = FILTER.StatisticalFilter = FILTER.Class( FILTER.Filter, {
    name: "StatisticalFilter"
    
    ,constructor: function StatisticalFilter( ) {
        var self = this;
        if ( !(self instanceof StatisticalFilter) ) return new StatisticalFilter();
        self.$super('constructor');
        self._dim = 0;
        self._indices = null;
        self._filterName = null;
        self._filter = null;
    }
    
    ,path: FILTER_FILTERS_PATH
    ,_dim: 0
    ,_indices: null
    ,_filter: null
    ,_filterName: null
    
    ,dispose: function( ) {
        var self = this;
        
        self._dim = null;
        self._indices = null;
        self._filter = null;
        self._filterName = null;
        self.$super('dispose');
        
        return self;
    }
    
    ,serialize: function( ) {
        var self = this;
        return {
            _filterName: self._filterName
            ,_dim: self._dim
            ,_indices: self._indices
        };
    }
    
    ,unserialize: function( params ) {
        var self = this;
        self._dim = params._dim;
        self._indices = TypedArray( params._indices, A32I );
        self._filterName = params._filterName;
        if ( self._filterName && Filters[ self._filterName ] )
            self._filter = Filters[ self._filterName ];
        return self;
    }
    
    ,median: function( d ) { 
        // allow only odd dimensions for median
        return this.set( null == d ? 3 : (d&1 ? d : d+1), "median" );
    }
    
    ,minimum: function( d ) { 
        return this.set( null == d ? 3 : (d&1 ? d : d+1), "minimum" );
    }
    ,erode: null
    
    ,maximum: function( d ) { 
        return this.set( null == d ? 3 : (d&1 ? d : d+1), "maximum" );
    }
    ,dilate: null
    
    ,set: function( d, filt ) {
        var self = this;
        self._filterName = filt; 
        self._filter = Filters[ filt ]; 
        self._dim = d; 
        // pre-compute indices, 
        // reduce redundant computations inside the main convolution loop (faster)
        var Indices=[], k, x, y,
            matArea=d*d, matRadius=d, matHalfSide=(matRadius>>1);
        x=0; y=0; k=0;
        while (k<matArea)
        { 
            Indices.push(x-matHalfSide); 
            Indices.push(y-matHalfSide);
            k++; x++; if (x>=matRadius) { x=0; y++; }
        }
        self._indices = new A32I(Indices);
        
        return self;
    }
    
    ,reset: function( ) {
        var self = this;
        self._filterName = null; 
        self._filter = null; 
        self._dim = 0; 
        self._indices = null;
        return self;
    }
    
    // used for internal purposes
    ,_apply: function(im, w, h) {
        var self = this;
        if ( !self._isOn || !self._dim )  return im;
        return self._filter( self, im, w, h );
    }
        
    ,canRun: function( ) {
        return this._isOn && this._dim;
    }
});
// aliiases
StatisticalFilter.prototype.erode = StatisticalFilter.prototype.minimum;
StatisticalFilter.prototype.dilate = StatisticalFilter.prototype.maximum;


//
//
// private methods
Filters = {
    "median": function( self, im, w, h ) {
        var 
            matRadius=self._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
            imageIndices=new A32I(self._indices),
            imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
            i, j, j2, x, ty, xOff, yOff, srcOff, 
            rM, gM, bM, r, g, b,
            medianR, medianG, medianB, len, len2,
            isOdd, matArea2=matArea<<1, bx=w-1, by=imArea-w
        ;
        
        rM = []; //new Array(matArea);
        gM = []; //new Array(matArea);
        bM = []; //new Array(matArea);
        
        // pre-compute indices, 
        // reduce redundant computations inside the main convolution loop (faster)
        for (j=0; j<matArea2; j+=2)
        { 
            // translate to image dimensions
            // the y coordinate
            imageIndices[j+1]*=w;
        }
        
        i=0; x=0; ty=0; 
        while (i<imLen)
        {
            // calculate the weighed sum of the source image pixels that
            // fall under the convolution matrix
            rM.length=0; gM.length=0; bM.length=0; 
            j=0; //j2=0;
            while (j < matArea2)
            {
                xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                {
                    srcOff=(xOff + yOff)<<2;
                    r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2]; 
                    rM.push(r); gM.push(g); bM.push(b);
                }
                j+=2; //j2+=1;
            }
            
            // sort them, this is SLOW, alternative implementation needed
            rM.sort(); gM.sort(); bM.sort();
            len=rM.length; len2=len>>>1;
            medianR= len&1 ? rM[len2] : ~~(0.5*rM[len2-1] + 0.5*rM[len2]);
            //len=gM.length; len2=len>>>1;
            medianG= len&1 ? gM[len2] : ~~(0.5*gM[len2-1] + 0.5*gM[len2]);
            //len=bM.length; len2=len>>>1;
            medianB= len&1 ? bM[len2] : ~~(0.5*bM[len2-1] + 0.5*bM[len2]);
            
            // output
            dst[i] = medianR;  dst[i+1] = medianG;   dst[i+2] = medianB;  
            dst[i+3] = im[i+3];
            
            // update image coordinates
            i+=4; x++; if (x>=w) { x=0; ty+=w; }
        }
        return dst;
    }
    
    ,"maximum": function( self, im, w, h ) {
        var 
            matRadius=self._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
            imageIndices=new A32I(self._indices),
            imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
            i, j, x, ty, xOff, yOff, srcOff, r, g, b, rM, gM, bM,
            matArea2=matArea<<1, bx=w-1, by=imArea-w
        ;
        
        // pre-compute indices, 
        // reduce redundant computations inside the main convolution loop (faster)
        for (j=0; j<matArea2; j+=2)
        { 
            // translate to image dimensions
            // the y coordinate
            imageIndices[j+1]*=w;
        }
        
        i=0; x=0; ty=0;
        while (i<imLen)
        {
            // calculate the weighed sum of the source image pixels that
            // fall under the convolution matrix
            rM=0; gM=0; bM=0; 
            j=0;
            while (j < matArea2)
            {
                xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                {
                    srcOff=(xOff + yOff)<<2;
                    r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2];
                    if (r>rM) rM=r; if (g>gM) gM=g; if (b>bM) bM=b;
                }
                j+=2;
            }
            
            // output
            dst[i] = rM;  dst[i+1] = gM;  dst[i+2] = bM;  dst[i+3] = im[i+3];
            
            // update image coordinates
            i+=4; x++; if (x>=w) { x=0; ty+=w; }
        }
        return dst;
    }
    
    ,"minimum": function( self, im, w, h ) {
        var 
            matRadius=self._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
            imageIndices=new A32I(self._indices),
            imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
            i, j, x, ty, xOff, yOff, srcOff, r, g, b, rM, gM, bM,
            matArea2=matArea<<1, bx=w-1, by=imArea-w
        ;
        
        // pre-compute indices, 
        // reduce redundant computations inside the main convolution loop (faster)
        for (j=0; j<matArea2; j+=2)
        { 
            // translate to image dimensions
            // the y coordinate
            imageIndices[j+1]*=w;
        }
        
        i=0; x=0; ty=0;
        while (i<imLen)
        {
            // calculate the weighed sum of the source image pixels that
            // fall under the convolution matrix
            rM=255; gM=255; bM=255; 
            j=0;
            while (j < matArea2)
            {
                xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                {
                    srcOff=(xOff + yOff)<<2;
                    r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2];
                    if (r<rM) rM=r; if (g<gM) gM=g; if (b<bM) bM=b;
                }
                j+=2;
            }
            
            // output
            dst[i] = rM;  dst[i+1] = gM; dst[i+2] = bM;  dst[i+3] = im[i+3];
            
            // update image coordinates
            i+=4; x++; if (x>=w) { x=0; ty+=w; }
        }
        return dst;
    }
};

}(FILTER);