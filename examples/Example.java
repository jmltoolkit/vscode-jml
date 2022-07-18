//-*- jml-keys: openjml

public /*@ spec_public */ class Example {    
    /*+key@ public invariant 2*a == invariant;*/    
    /*+openjml@ public invariant 2*a == invariant;*/
    /*@ public invariant 2*a == invariant;*/    
}
