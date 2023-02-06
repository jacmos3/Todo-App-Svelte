<script>
	import Todo from "./Todo.svelte"
    import {createEventDispatcher} from "svelte";

    export let todos;

    //this is not mandatory, since if we do not intercept it here, it will be intercepted by the parent by default.
    const dispatch = createEventDispatcher();
    //this is not mandatory, since if we do not intercept it here, it will be intercepted by the parent by default.
    function forward(event){
        console.log("In todos: ", event.detail);
        dispatch("compl", event.detail);
    }

</script>
<!-- List of actual todos -->
<div class="app-body">
    <ul>
        { #each todos as todo }
            <Todo 
                itemId = {todo.id} 
                itemText = {todo.text} 
                completed = {todo.completed}
                on:compl = {forward}
                on:deleted 
            />
        {/each}
    </ul>
</div>

<style>
    ul {
            list-style-type: none;
            -webkit-padding-start: 0;
            padding-left: 0px;
        }
        
    .app-body {
        flex-grow: 1;
        max-height: 600px;
        overflow-x: hidden;
    }
    
     
</style>