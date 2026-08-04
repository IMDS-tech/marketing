export function BrandGlyph({compact=false}:{compact?:boolean}){
  return <span className={`brand-glyph ${compact?'brand-glyph--compact':''}`} aria-hidden="true">
    <i/><i/><i/><i/>
  </span>
}
