//-*- jml-keys: openjml

public class Example {
    /*+key@ public invariant 2*a == invariant;*/    
    /*+openjml@ public invariant stupid_name : 2*a == invariant;*/
    /*@ public invariant 2*a == invariant;*/    

    public int foo = 2;

    /*@
    public model_behavior test :
    requires true;
    ensures true;
    assignable \nothing;
    public model int bar(int a);
    */


    /*@
    public behavior my_contract: 
        requires (\exists int i; a*b == i*2);
        ensures \result >= 2;
    */
    public void baz(int a, int b) {
        //@ assert true;
    }
}
 