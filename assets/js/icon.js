
// Icon picker component
Vue.component('icon-picker', {
    template: '#icon-picker',
    props: ['items'],
    data() {
        return { query: '', selected: undefined };
    },
    created() {
        this.query='';
    },
    computed: {
        filteredItems() {
            if(!(this.query || "").trim()) return this.items;
            var query = this.query.trim().toLowerCase().split(' ');
            const match = (item, term) =>  item.name.includes(term) || (item.tags || []).some(t => t.includes(term));
            return this.items ? this.items.filter(item => query.some(term => match(item, term))) : [];
        }
    },
    methods: {
        searchPlaceholder() {
            if(!this.items) return '';
            if(this.items.length == 0) return 'loading...';
            return `search ${this.items.length} icons...`;
        },
        iconClass(item){
            let clazz = { "mdi": true };
            clazz['mdi-'+item.name] = true;
            return clazz;
        },
        getUrl(item){
            if(!item.url) {
                item.url = `https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/${item.name}.svg`;
            }
            return item.url;
        },
        select(item) {
            console.log('selected', item);
            this.selected = item;
            this.getUrl(item);
            this.$emit('selection', item);
        }
    }
})

// Icon select
var iconSelect = new Vue({
    el: '#icon-select',
    data: {
        meta: [],
        selected: undefined,
        icon: '../assets/images/icon.png'
    },
    mounted() {
        $.getJSON("../../../assets/mdi/meta.json", meta => setTimeout(() => this.meta = meta, 100));
    },
    methods: {
        iconClass(item){
            let clazz = { "mdi": true };
            clazz['mdi-'+item.name] = true;
            return clazz;
        },
        async onIconSelect(item) {
            console.log('setRemoteIcon', item);

            try {
                this.selected = item;
                const path = await Homey.emit('setRemoteIcon', item);
            } catch(e) {
                this.icon = '../assets/images/icon.png';
                console.error(e);
                Homey.alert('Failed to select MDI icon', 'error');
            }
        },
        loadIcon(event) {
            const img = event.target.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(img);
            reader.onload = async () => {
                const imgBase64 = reader.result;
                if (!imgBase64 || !imgBase64.length) {
                    return Homey.alert('Invalid image', 'error');
                }
                if (imgBase64.length > 1048000) {
                    return Homey.alert('Image size is too large', 'error');
                }
                
                this.selected = undefined;
                this.icon = imgBase64;
                try {
                    const path = await Homey.emit('saveIcon', imgBase64);
                } catch(e) {
                    console.error(e);
                    Homey.alert('Failed to upload icon', 'error');
                }
            };
        }
    }
});
