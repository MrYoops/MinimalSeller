import React, { useState } from 'react'
import { FiPlus, FiTrash2, FiPackage } from 'react-icons/fi'
import { toast } from 'sonner'

function OrderSplitTab({ order, onSplit }) {
  const [boxes, setBoxes] = useState([
    {
      box_number: 1,
      items: order.items.map(item => ({ ...item }))
    }
  ])

  const addBox = () => {
    setBoxes([...boxes, {
      box_number: boxes.length + 1,
      items: []
    }])
    toast.success('Короб добавлен')
  }

  const removeBox = (boxIndex) => {
    if (boxes.length === 1) {
      toast.error('Нельзя удалить единственный короб')
      return
    }
    
    const updatedBoxes = boxes.filter((_, idx) => idx !== boxIndex)
    setBoxes(updatedBoxes)
    toast.success('Короб удалён')
  }

  const updateItemQuantity = (boxIndex, itemIndex, newQuantity) => {
    const updated = [...boxes]
    updated[boxIndex].items[itemIndex].quantity = parseInt(newQuantity) || 0
    setBoxes(updated)
  }

  const moveItemToBox = (fromBoxIndex, itemIndex, toBoxIndex) => {
    const updated = [...boxes]
    const item = updated[fromBoxIndex].items[itemIndex]
    
    // Удалить из исходного короба
    updated[fromBoxIndex].items.splice(itemIndex, 1)
    
    // Добавить в целевой короб
    updated[toBoxIndex].items.push({ ...item })
    
    setBoxes(updated)
    toast.success('Товар перемещён')
  }

  const handleSave = async () => {
    // Валидация
    const totalItems = {}
    order.items.forEach(item => {
      totalItems[item.article] = item.quantity
    })

    const boxItems = {}
    boxes.forEach(box => {
      box.items.forEach(item => {
        boxItems[item.article] = (boxItems[item.article] || 0) + item.quantity
      })
    })

    // Проверка что все товары распределены
    for (const article in totalItems) {
      if (!boxItems[article] || boxItems[article] !== totalItems[article]) {
        toast.error(`Неверное количество для артикула ${article}. Ожидается: ${totalItems[article]}, распределено: ${boxItems[article] || 0}`)
        return
      }
    }

    // Проверка что нет пустых коробов
    if (boxes.some(box => box.items.length === 0)) {
      toast.error('Удалите пустые короба')
      return
    }

    // Формат для API
    const splitData = {
      boxes: boxes.map(box => ({
        box_number: box.box_number,
        items: box.items.map(item => ({
          article: item.article,
          quantity: item.quantity
        }))
      }))
    }

    await onSplit(splitData)
  }

  const canSplit = order.marketplace !== 'wb' && boxes.length > 1

  if (order.marketplace === 'wb') {
    return (
      <div className="text-center py-12" data-testid="order-split-tab">
        <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
        <p className="text-mm-text-secondary font-mono mb-2">// Разделение заказов не поддерживается для Wildberries</p>
        <p className="text-sm text-mm-text-tertiary font-mono">Wildberries использует другую логику сборки</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="order-split-tab">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm uppercase font-mono text-mm-cyan">// Разделение на короба</h3>
          <p className="text-xs text-mm-text-secondary font-mono mt-1">
            Перераспределите товары между коробами. Общее количество должно совпадать.
          </p>
        </div>
        <button
          onClick={addBox}
          className="btn-neon flex items-center space-x-2"
          data-testid="add-box-btn"
        >
          <FiPlus />
          <span>ДОБАВИТЬ КОРОБ</span>
        </button>
      </div>

      {/* Короба */}
      <div className="space-y-4">
        {boxes.map((box, boxIndex) => (
          <div key={boxIndex} className="border border-mm-border rounded-lg p-4" data-testid={`box-${boxIndex}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-mono text-mm-cyan uppercase">Короб #{box.box_number}</h4>
              {boxes.length > 1 && (
                <button
                  onClick={() => removeBox(boxIndex)}
                  className="p-2 text-mm-red hover:bg-mm-red/10 rounded transition-colors"
                  data-testid={`remove-box-${boxIndex}`}
                >
                  <FiTrash2 size={16} />
                </button>
              )}
            </div>

            {box.items.length === 0 ? (
              <p className="text-sm text-mm-text-secondary font-mono text-center py-4">
                // Короб пуст. Перенесите сюда товары или удалите короб.
              </p>
            ) : (
              <div className="space-y-2">
                {box.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between bg-mm-border/20 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-mono text-mm-text">{item.name}</p>
                      <p className="text-xs text-mm-text-secondary font-mono">Артикул: {item.article}</p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div>
                        <label className="text-xs text-mm-text-secondary uppercase font-mono block mb-1">Кол-во:</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(boxIndex, itemIndex, e.target.value)}
                          className="w-20 px-2 py-1 bg-mm-dark border border-mm-border rounded text-mm-text font-mono text-center focus:border-mm-cyan outline-none"
                          data-testid={`item-quantity-${boxIndex}-${itemIndex}`}
                        />
                      </div>
                      
                      {boxes.length > 1 && (
                        <div>
                          <label className="text-xs text-mm-text-secondary uppercase font-mono block mb-1">В короб:</label>
                          <select
                            onChange={(e) => {
                              const targetBox = parseInt(e.target.value)
                              if (targetBox !== boxIndex) {
                                moveItemToBox(boxIndex, itemIndex, targetBox)
                              }
                            }}
                            value={boxIndex}
                            className="px-2 py-1 bg-mm-dark border border-mm-border rounded text-mm-text font-mono focus:border-mm-cyan outline-none"
                          >
                            {boxes.map((_, idx) => (
                              <option key={idx} value={idx}>#{idx + 1}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Кнопка сохранения */}
      <div className="flex justify-end pt-4 border-t border-mm-border">
        <button
          onClick={handleSave}
          disabled={!canSplit}
          className="btn-neon disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="save-split-btn"
        >
          СОХРАНИТЬ РАЗДЕЛЕНИЕ
        </button>
      </div>

      {boxes.length === 1 && (
        <p className="text-xs text-mm-text-tertiary font-mono text-center">
          // Добавьте ещё один короб для разделения заказа
        </p>
      )}
    </div>
  )
}

export default OrderSplitTab
