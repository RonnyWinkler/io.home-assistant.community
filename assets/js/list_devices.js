!function(){
  const 
    l=document.getElementById("16709463134490.7849481381070716"),
    i=l.querySelector("#homey-list-devices-message"),
    a=l.querySelector("#homey-list-devices-select-devices"),
    d=l.querySelector("#template-select-device"),
    t=l.querySelector("[data-hy-select-all-devices]");
  var search = l.querySelector("[data-hy-search]");
  var nextButton = document.getElementById('hy-nav-continue');
  nextButton.addEventListener("click",nextView);
  var nextButtonDiv = document.getElementById('hy-nav-div-continue');
  // document.getElementById('hy-nav-continue').textContent=Homey.__("pair.list_devices.continue");
  var visibleDevicesCount;
  var e=l.querySelector("[data-hy-select-all-devices-button]");
  const 
    n=l.querySelector("[data-hy-select-all-devices-text]"),
    o=l.querySelector("[data-hy-select-all-devices-count]"),
    c=Homey.getCurrentView(),
    u={};
  let 
    s,
    y=!1;
  const 
    m=[];
  
  function nextView(){
    Homey.showView("icon");
  }

  function checkNextButton(selectedDevices){
    if (selectedDevices != undefined && selectedDevices.length > 0){  
      nextButton.className = "homey-button-primary-full";
      nextButton.disabled = false;
    }
    else{
      nextButton.className = "homey-button-primary-full is-disabled";
      nextButton.disabled = true;
    }
  }

  function r(){
    //return l.querySelectorAll("[data-template-device-input]:checked").length===m.length
    return l.querySelectorAll("[data-template-device-input]:checked").length===visibleDevicesCount;
  }
  function v(e){
    [].concat(e).filter(f).forEach(function(e){
      var t=m.push(e)-1;
      {
        var i=t;
        const 
          n=d.content.cloneNode(!0),
          o=n.querySelector("[data-template-device-label]"),
          c=n.querySelector("[data-template-device-input]"),
          s=n.querySelector("[data-template-device-name]"),
          r=n.querySelector("[data-template-device-icon]");
        function l(e){
          if(y&&e)
            for(const t in u)
              u[t]=!1;
            u[i]=e,g()
        }
        c.type=y?"radio":"checkbox",
        c.addEventListener("change",function(){l(!!c.checked)}),
        o.addEventListener("click",function(){_()}),
        s.setAttribute("title",e.name),
        s.textContent=e.name,
        e.iconUrl&&(r.style.webkitMaskImage="url("+e.iconUrl+")",r.style.maskImage="url("+e.iconUrl+")", delete e.iconUrl),
        e.iconObj&&(r.style.webkitMaskImage="url("+e.iconObj.url+")",
          r.style.maskImage="url("+e.iconObj.url+")",
          delete e.iconObj
        ),
        //!y||y&&1===m.length?(c.checked="checked",l(!0)):l(!1),
        a.appendChild(n),
        window.found_devices[JSON.stringify(e.data)]=e;

        // Select first device as default
        // if (m.length == 1){
        //   c.checked="checked";
        //   l(!0);
        // }
      }
    }),
    g(),
    e=m.length<=1||y,
    t.classList.toggle("is-hidden",e),
    _(),
    e=m.length,
    o.textContent=e;
    visibleDevicesCount = e;
  }
  
  function _(){
    let e=Homey.__("pair.list_devices.select_all");
    r()&&(e=Homey.__("pair.list_devices.deselect_all")),
    n.textContent=e
  }
  
  function f(t){
    return !m.find(function(e){
      return JSON.stringify(e.data)===JSON.stringify(t.data)
    })
  }
  
  function g(){
    var e,
    t=m.filter(function(e,t){
      return u[t]
    });
    console.log(t);
    checkNextButton(t);
    JSON.stringify(t)!==JSON.stringify(s)&&(
      s=t,
      Homey.emit(c+"_selection",t),
      (e=Homey.getNextViewByTemplate("add_devices"))&&Homey.setViewStoreValue(e,"devices",t,function(e){if(e)return console.error(e)}),
      window.selected_devices=t.map(function(e){
        return JSON.stringify(e.data)
      })
    )
  }

  search.placeholder = Homey.__("pair.list_devices.search");
  window.found_devices={},
  window.selected_devices=[],
  Homey.setTitle(Homey.__("pair.list_devices.title")),
  Homey.setSubtitle(Homey.__("pair.list_devices.subtitle")),
  Homey.showLoadingOverlay(Homey.__("pair.list_devices.loading")),
  Homey.getOptions(
    function(e,t){
      if(e)
        return Homey.error(e);
      t.singular&&(y=!0,Homey.setSubtitle(Homey.__("pair.list_devices.subtitle_singular"))),
      t.title&&Homey.setTitle(Homey.__(t.title)),
      t.subtitle&&Homey.setSubtitle(Homey.__(t.subtitle))
    }
  ),
  Homey.on("list_devices",function(e){Homey.hideLoadingOverlay(),v(e)}),
  Homey.emit("list_devices",null,function(e,t){
    return Homey.hideLoadingOverlay(),
    e?(i.textContent=e.message||e.toString(),Homey.setNavigationClose()):
      t.length?v(t):(
        Homey.setTitle(Homey.__("pair.list_devices.nonew")),
        Homey.setSubtitle(null),
        i.textContent=Homey.__("pair.list_devices.nonew"),
        Homey.setNavigationClose(),
        nextButtonDiv.style.visibility = 'hidden'
      )
    }
  ),
  e.addEventListener("click",()=>{
    {
      const e=l.querySelectorAll("[data-template-device-input]"),
      t=!1===r();
      e.forEach((e,index)=>{
        console.log(e);
        if (e.parentElement.style.display != 'none'){
          e.checked=t;
          u[index]=t;
        }
      }),
      _();
      // for(const i in u)
      //   u[i]=t;
      g()
    }
  }),
  search.addEventListener("input",()=>{
    {
      let count = 0;
      const inputList=l.querySelectorAll("[data-template-device-input]");
      inputList.forEach((inputElement, index)=>{
        console.log(inputElement);
        console.log(m[index]);
        console.log(u[index]);

        if (m[index].name.toLowerCase().includes(search.value.toLowerCase())){
          // inputElement.checked = true;
          inputElement.parentElement.style.display = 'block';
          // u[index] = true;
          // m[index].checked = true;
          count ++;
        }
        else{
          inputElement.checked = false;
          inputElement.parentElement.style.display = 'none';
          u[index] = false;
          m[index].checked = false;
        }
      });
      o.textContent=count;
      visibleDevicesCount = count;
      _();
      g();
    }
  })

}()