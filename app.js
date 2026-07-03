// --- Memory State Object ---
let appData = {
    wardrobe: [],     
    currentFit: [],  
    savedFits: []    
};

let activeOutfitId = null;
let editingFitId = null;

// --- DOM References ---
const imageUpload = document.getElementById('imageUpload');
const categorySelect = document.getElementById('categorySelect');
const uploadBtn = document.getElementById('uploadBtn');
const wardrobeGrid = document.getElementById('wardrobeGrid');
const currentOutfitCanvas = document.getElementById('currentOutfit');
const outfitNameInput = document.getElementById('outfitNameInput');
const saveOutfitBtn = document.getElementById('saveOutfitBtn');
const savedOutfitsGrid = document.getElementById('savedOutfitsGrid');

// Menu UI Elements
const sideMenu = document.getElementById('sideMenu');
const openMenuBtn = document.getElementById('openMenuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const menuFitsList = document.getElementById('menuFitsList');

// Modal UI Elements
const outfitModal = document.getElementById('outfitModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalOutfitName = document.getElementById('modalOutfitName');
const modalItemsGrid = document.getElementById('modalItemsGrid');
const deleteEntireFitBtn = document.getElementById('deleteEntireFitBtn');
const editFitBtn = document.getElementById('editFitBtn');


// --- Cloud Persistence Layer (IndexedDB Upgrade) ---
// LocalStorage only holds 5MB, causing fits to randomly "not save" when quota is hit by base64 images.
// IndexedDB holds hundreds of MBs, fixing the save failure issue permanently!
const dbName = "FitManagerDB";
const storeName = "appState";

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToCloud() {
    try {
        const db = await initDB();
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(appData, 'fitData');
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => { console.log("Saved to secure IndexedDB cloud."); resolve(); };
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error("Storage error:", error);
        alert("Failed to save to cloud storage.");
    }
}

async function loadFromCloud() {
    try {
        const db = await initDB();
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get('fitData');
        return new Promise((resolve) => {
            request.onsuccess = () => {
                if (request.result) appData = request.result;
                resolve();
            };
            request.onerror = () => resolve(); // Fail silently on first load
        });
    } catch (error) {
        console.error("Error pulling cloud data:", error);
    }
}


// --- Component Initialization ---
window.addEventListener('DOMContentLoaded', async () => {
    await loadFromCloud();
    renderWardrobe();
    renderCurrentOutfit();
    renderSavedOutfits();
    renderMenu();
});


// --- Menu Visibility Toggles ---
openMenuBtn.addEventListener('click', () => sideMenu.classList.add('open'));
closeMenuBtn.addEventListener('click', () => sideMenu.classList.remove('open'));


// --- Wardrobe Management Logic ---
uploadBtn.addEventListener('click', () => {
    const files = imageUpload.files;
    const category = categorySelect.value;

    if (files.length === 0) {
        alert("Please select an image first.");
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const newItem = {
                id: Date.now() + Math.random(),
                category: category,
                imageUrl: e.target.result
            };
            appData.wardrobe.push(newItem);
            await saveToCloud();
            renderWardrobe();
        };
        reader.readAsDataURL(file);
    });
    imageUpload.value = '';
});

function renderWardrobe() {
    wardrobeGrid.innerHTML = '';
    appData.wardrobe.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'wardrobe-item-wrapper';

        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.className = 'clothing-item';
        img.title = item.category;
        
        img.addEventListener('click', () => {
            appData.currentFit.push(item);
            renderCurrentOutfit();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-wardrobe';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            if(confirm("Are you sure you want to delete this item from your wardrobe?")) {
                appData.wardrobe.splice(index, 1);
                appData.currentFit = appData.currentFit.filter(el => el.id !== item.id);
                await saveToCloud();
                renderWardrobe();
                renderCurrentOutfit();
            }
        });

        wrapper.appendChild(img);
        wrapper.appendChild(delBtn);
        wardrobeGrid.appendChild(wrapper);
    });
}


// --- Outfit Canvas Operations ---
function renderCurrentOutfit() {
    currentOutfitCanvas.innerHTML = '';
    appData.currentFit.forEach((item, index) => {
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.className = 'clothing-item';
        img.addEventListener('click', () => {
            appData.currentFit.splice(index, 1);
            renderCurrentOutfit();
        });
        currentOutfitCanvas.appendChild(img);
    });
}


// --- Save & Construct Outfits ---
saveOutfitBtn.addEventListener('click', async () => {
    if (appData.currentFit.length === 0) {
        alert("Your fit canvas is empty. Add some clothes first.");
        return;
    }

    const assignedName = outfitNameInput.value.trim() || `Fit #${appData.savedFits.length + 1}`;
    
    if (editingFitId !== null) {
        const fitIndex = appData.savedFits.findIndex(f => f.id === editingFitId);
        if (fitIndex > -1) {
            appData.savedFits[fitIndex].name = assignedName;
            appData.savedFits[fitIndex].items = [...appData.currentFit];
        }
        editingFitId = null;
        saveOutfitBtn.textContent = 'Save Outfit';
    } else {
        const configuredOutfit = {
            id: Date.now(),
            name: assignedName,
            items: [...appData.currentFit]
        };
        appData.savedFits.push(configuredOutfit);
    }

    appData.currentFit = [];
    outfitNameInput.value = '';

    await saveToCloud();
    renderCurrentOutfit();
    renderSavedOutfits();
    renderMenu();
});


// --- Layout Render Engine: Main Gallery & Sidebar ---
function renderSavedOutfits() {
    savedOutfitsGrid.innerHTML = '';
    appData.savedFits.forEach(fit => {
        const card = document.createElement('div');
        card.className = 'saved-outfit-card';
        card.addEventListener('click', () => openEnlargedModal(fit.id));

        const title = document.createElement('h4');
        title.textContent = fit.name;
        card.appendChild(title);

        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'saved-outfit-thumbnails';
        
        fit.items.slice(0, 4).forEach(item => {
            const thumb = document.createElement('img');
            thumb.src = item.imageUrl;
            thumbContainer.appendChild(thumb);
        });

        for(let i = fit.items.length; i < 4; i++) {
            const emptyDiv = document.createElement('div');
            thumbContainer.appendChild(emptyDiv);
        }

        card.appendChild(thumbContainer);
        savedOutfitsGrid.appendChild(card);
    });
}

function renderMenu() {
    menuFitsList.innerHTML = '';
    appData.savedFits.forEach(fit => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-fit-item';
        menuItem.textContent = fit.name;
        menuItem.addEventListener('click', () => {
            sideMenu.classList.remove('open');
            openEnlargedModal(fit.id);
        });
        menuFitsList.appendChild(menuItem);
    });
}


// --- Lightbox/Modal Control Center ---
function openEnlargedModal(fitId) {
    activeOutfitId = fitId;
    const targets = appData.savedFits.find(f => f.id === fitId);
    if (!targets) return;

    modalOutfitName.textContent = targets.name;
    renderModalGrid(targets);
    outfitModal.classList.add('open');
}

closeModalBtn.addEventListener('click', () => outfitModal.classList.remove('open'));
window.addEventListener('click', (e) => {
    if (e.target === outfitModal) outfitModal.classList.remove('open');
});

deleteEntireFitBtn.addEventListener('click', async () => {
    if(confirm("Are you sure you want to delete this fit?")) {
        appData.savedFits = appData.savedFits.filter(f => f.id !== activeOutfitId);
        
        if (editingFitId === activeOutfitId) {
            editingFitId = null;
            appData.currentFit = [];
            outfitNameInput.value = '';
            saveOutfitBtn.textContent = 'Save Outfit';
            renderCurrentOutfit();
        }

        await saveToCloud();
        outfitModal.classList.remove('open');
        renderSavedOutfits();
        renderMenu();
    }
});

editFitBtn.addEventListener('click', () => {
    const targetFit = appData.savedFits.find(f => f.id === activeOutfitId);
    if (!targetFit) return;

    appData.currentFit = [...targetFit.items];
    outfitNameInput.value = targetFit.name;
    editingFitId = targetFit.id;

    saveOutfitBtn.textContent = 'Update Outfit';
    outfitModal.classList.remove('open');
    renderCurrentOutfit();
    
    document.querySelector('.builder-section').scrollIntoView({ behavior: 'smooth' });
});


// Build out items inside the enlarged view modal
function renderModalGrid(outfit) {
    modalItemsGrid.innerHTML = '';

    if (outfit.items.length === 0) {
        modalItemsGrid.innerHTML = '<p class="hint">This outfit is empty.</p>';
        return;
    }

    outfit.items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'modal-item-card';

        const img = document.createElement('img');
        img.src = item.imageUrl;

        const actionWrapper = document.createElement('div');
        actionWrapper.className = 'modal-actions';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
            outfit.items.splice(index, 1);
            
            if (editingFitId === outfit.id) {
                appData.currentFit = [...outfit.items];
                renderCurrentOutfit();
            }

            await saveToCloud();
            renderModalGrid(outfit);
            renderSavedOutfits();
        });

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn-replace';
        replaceBtn.textContent = 'Replace';
        replaceBtn.addEventListener('click', () => {
            const localSelector = document.createElement('input');
            localSelector.type = 'file';
            localSelector.accept = 'image/*';
            
            localSelector.onchange = e => {
                const updatedFile = e.target.files[0];
                if (!updatedFile) return;

                const inlineReader = new FileReader();
                inlineReader.onload = async function(evt) {
                    const newImageUrl = evt.target.result;
                    outfit.items[index].imageUrl = newImageUrl;
                    
                    if (editingFitId === outfit.id) {
                        appData.currentFit = [...outfit.items];
                        renderCurrentOutfit();
                    }

                    const existsInWardrobe = appData.wardrobe.some(w => w.imageUrl === newImageUrl);
                    if(!existsInWardrobe) {
                        appData.wardrobe.push({
                            id: Date.now() + Math.random(),
                            category: item.category,
                            imageUrl: newImageUrl
                        });
                    }

                    await saveToCloud();
                    renderModalGrid(outfit);
                    renderSavedOutfits();
                    renderWardrobe();
                };
                inlineReader.readAsDataURL(updatedFile);
            };
            localSelector.click();
        });

        actionWrapper.appendChild(replaceBtn);
        actionWrapper.appendChild(removeBtn);
        card.appendChild(img);
        card.appendChild(actionWrapper);
        modalItemsGrid.appendChild(card);
    });
}
